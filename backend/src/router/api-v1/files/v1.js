import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import config from '../../../config.js';
import { requireRole } from '../../../middleware/auth.js';

const filesRouter = express.Router();

const ROOT = path.resolve(config.FILES_ROOT || 'overlays');
const MAX_FILE_SIZE =
  Number(config.FILES_MAX_FILE_SIZE_MB || 100) * 1024 * 1024;
const MAX_FILES = Number(config.FILES_MAX_COUNT || 2000);
const TMP_DIR = path.join(os.tmpdir(), 'overlay-uploads');

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(TMP_DIR, { recursive: true }).then(
        () => cb(null, TMP_DIR),
        (err) => cb(err),
      );
    },
  }),
  // preservePath keeps the relative path (folder/sub/file.js) in originalname
  preservePath: true,
  defParamCharset: 'utf8',
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

/** Splits a user supplied relative path into safe segments. */
function toSegments(input) {
  if (input === undefined || input === null || input === '') return [];
  if (typeof input !== 'string' || input.includes('\0')) {
    throw new HttpError(400, 'Invalid path');
  }
  const segments = input.split(/[\\/]+/).filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..' || /^[a-zA-Z]:$/.test(s))) {
    throw new HttpError(400, 'Invalid path');
  }
  return segments;
}

function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Resolves a relative path inside ROOT and guards against symlink escapes. */
async function resolveSafe(input) {
  const target = path.resolve(ROOT, ...toSegments(input));
  if (!isInside(ROOT, target)) throw new HttpError(400, 'Invalid path');

  const realRoot = await fs.realpath(ROOT);
  let probe = target;
  for (;;) {
    try {
      const real = await fs.realpath(probe);
      if (!isInside(realRoot, real)) throw new HttpError(400, 'Invalid path');
      break;
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }
  return target;
}

async function statOrNull(p) {
  try {
    return await fs.lstat(p);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
    throw err;
  }
}

async function moveFile(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    await fs.copyFile(src, dest);
    await fs.unlink(src);
  }
}

const relOf = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    upload.array('files')(req, res, (err) => {
      if (!err) return resolve();
      if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return reject(new HttpError(status, err.message));
      }
      reject(err);
    });
  });
}

const manage = requireRole('owner', 'overlay:manage');

// GET /api/v1/files?path=<dir> — list a directory
filesRouter.get('/', manage, async (req, res, next) => {
  try {
    await fs.mkdir(ROOT, { recursive: true });
    const dir = await resolveSafe(req.query.path);
    const stat = await statOrNull(dir);
    if (!stat?.isDirectory()) throw new HttpError(404, 'Directory not found');

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const data = await Promise.all(
      entries
        .filter((e) => e.isDirectory() || e.isFile())
        .map(async (e) => {
          const s = await fs.stat(path.join(dir, e.name));
          return {
            name: e.name,
            type: e.isDirectory() ? 'directory' : 'file',
            size: e.isFile() ? s.size : null,
            modifiedAt: s.mtime,
          };
        }),
    );
    data.sort((a, b) =>
      a.type === b.type
        ? a.name.localeCompare(b.name)
        : a.type === 'directory'
          ? -1
          : 1,
    );
    res.json({ success: true, data: { path: relOf(dir), entries: data } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/files/upload?path=<destDir>&conflict=reject|overwrite|replace
// multipart field "files"; the filename is the relative path (folder/file.js).
//  reject    (default) — 409 if any target already exists
//  overwrite — replace existing files, merge into existing folders
//  replace   — delete each top-level file/folder in the upload first, then write
filesRouter.post('/upload', manage, async (req, res, next) => {
  let files = [];
  try {
    await runUpload(req, res);
    files = req.files ?? [];
    if (files.length === 0) throw new HttpError(400, 'No files uploaded');

    const conflict = req.query.conflict ?? 'reject';
    if (!['reject', 'overwrite', 'replace'].includes(conflict)) {
      throw new HttpError(400, 'Invalid conflict mode');
    }

    await fs.mkdir(ROOT, { recursive: true });
    const destDir = await resolveSafe(req.query.path);

    const plan = [];
    for (const file of files) {
      const segments = toSegments(file.originalname);
      if (segments.length === 0) throw new HttpError(400, 'Invalid file name');
      const dest = await resolveSafe(path.join(relOf(destDir), ...segments));
      if (dest === ROOT) throw new HttpError(400, 'Invalid file name');
      plan.push({ file, dest, top: segments[0] });
    }

    const topLevel = [...new Set(plan.map((p) => p.top))];

    if (conflict === 'replace') {
      for (const name of topLevel) {
        const target = await resolveSafe(path.join(relOf(destDir), name));
        await fs.rm(target, { recursive: true, force: true });
      }
    } else {
      const conflicts = [];
      for (const { dest } of plan) {
        const existing = await statOrNull(dest);
        if (!existing) continue;
        if (existing.isDirectory()) {
          throw new HttpError(409, `A folder exists at ${relOf(dest)}`);
        }
        conflicts.push(relOf(dest));
      }
      if (conflict === 'reject' && conflicts.length > 0) {
        throw new HttpError(409, 'Some files already exist', { conflicts });
      }
    }

    for (const { file, dest } of plan) {
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await moveFile(file.path, dest);
    }

    res.status(201).json({
      success: true,
      data: {
        uploaded: plan.map((p) => relOf(p.dest)),
        replaced: conflict === 'replace' ? topLevel : [],
      },
    });
  } catch (err) {
    next(err);
  } finally {
    await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
  }
});

// POST /api/v1/files/folder — body: { path } creates a folder
filesRouter.post('/folder', manage, async (req, res, next) => {
  try {
    await fs.mkdir(ROOT, { recursive: true });
    const segments = toSegments(req.body?.path);
    if (segments.length === 0) throw new HttpError(400, 'path is required');
    const dir = await resolveSafe(req.body.path);
    if (await statOrNull(dir)) throw new HttpError(409, 'Already exists');
    await fs.mkdir(dir, { recursive: true });
    res.status(201).json({ success: true, data: { path: relOf(dir) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/files/move — body: { from, to, overwrite? } renames/moves; overwrite replaces the target
filesRouter.post('/move', manage, async (req, res, next) => {
  try {
    await fs.mkdir(ROOT, { recursive: true });
    const { from, to, overwrite } = req.body ?? {};
    if (toSegments(from).length === 0 || toSegments(to).length === 0) {
      throw new HttpError(400, 'from and to are required');
    }
    const src = await resolveSafe(from);
    const dest = await resolveSafe(to);
    if (!(await statOrNull(src))) throw new HttpError(404, 'Source not found');
    if (dest === src || isInside(src, dest)) {
      throw new HttpError(400, 'Invalid destination');
    }
    if (await statOrNull(dest)) {
      if (!overwrite) throw new HttpError(409, 'Destination already exists');
      await fs.rm(dest, { recursive: true, force: true });
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
    res.json({ success: true, data: { path: relOf(dest) } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/files?path=<file-or-folder> — folders are removed recursively
filesRouter.delete('/', manage, async (req, res, next) => {
  try {
    await fs.mkdir(ROOT, { recursive: true });
    if (toSegments(req.query.path).length === 0) {
      throw new HttpError(400, 'Refusing to delete the root folder');
    }
    const target = await resolveSafe(req.query.path);
    if (!(await statOrNull(target))) throw new HttpError(404, 'Not found');
    await fs.rm(target, { recursive: true, force: true });
    res.json({ success: true, data: { deleted: relOf(target) } });
  } catch (err) {
    next(err);
  }
});

// Keeps `extra` details (e.g. conflicts) in the response
filesRouter.use((err, _req, res, next) => {
  if (!(err instanceof HttpError)) return next(err);
  res
    .status(err.status)
    .json({ success: false, error: err.message, ...err.extra });
});

export default filesRouter;
