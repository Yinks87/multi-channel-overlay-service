import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  createOverlay,
  getActiveOverlays,
  getAllOverlays,
  getOverlaysForStreamer,
  deleteOverlay,
  updateOverlay,
} from '../../../db/services/overlayService.js';
import {
  registerOverlay,
  unregisterOverlay,
} from '../../../overlays/overlays-registry.js';
import { requireRole } from '../../../middleware/auth.js';

const overlayRouter = express.Router();
const execFileAsync = promisify(execFile);

// GET /folder-picker — opens a native folder browser dialog on the server machine (Windows only)
overlayRouter.get(
  '/folder-picker',
  requireRole('owner', 'overlay:manage'),
  async (req, res, next) => {
    if (process.platform !== 'win32') {
      return res
        .status(400)
        .json({
          success: false,
          error: 'Folder picker is only supported on Windows',
        });
    }
    try {
      const script = [
        'Add-Type -AssemblyName System.Windows.Forms;',
        '$d = New-Object System.Windows.Forms.FolderBrowserDialog;',
        '$d.Description = "Select the overlay folder";',
        '$d.ShowNewFolderButton = $true;',
        'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $d.SelectedPath }',
      ].join(' ');
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 120_000 },
      );
      res.json({ success: true, path: stdout.trim() || null });
    } catch (err) {
      next(err);
    }
  },
);

// GET: any authenticated user — owners/managers see all; others see only their assigned or unassigned active overlays
overlayRouter.get('/', requireRole(), async (req, res) => {
  const { roles, sub: userId } = req.currentUser;
  const canManage = roles.includes('owner') || roles.includes('overlay:manage');

  const overlays = canManage
    ? await getAllOverlays()
    : await getOverlaysForStreamer({ userId, roles });

  if (!overlays || overlays.length === 0) {
    return res.status(404).json({ success: false, error: 'No overlays found' });
  }

  res.json({ success: true, data: overlays });
});

overlayRouter.post(
  '/',
  requireRole('owner', 'overlay:manage'),
  async (req, res, next) => {
    const {
      routePath,
      name,
      folderPath,
      entryFile,
      notes,
      params,
      streamerIds,
      overlayType,
      width,
      height,
    } = req.body;
    if (!routePath || !name || !folderPath || !entryFile) {
      return res.status(400).json({
        success: false,
        error: 'Missing routePath, name, folderPath, or entryFile',
      });
    }

    try {
      registerOverlay({ routePath, name, folderPath, entryFile });
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }

    const id = await createOverlay({
      routePath,
      name,
      folderPath,
      entryFile,
      notes,
      params,
      streamerIds,
      overlayType,
      width,
      height,
    });

    if (!id) {
      unregisterOverlay(routePath);
      return res
        .status(500)
        .json({ success: false, error: 'Failed to add new overlay' });
    }

    res
      .status(201)
      .json({ success: true, data: { id, name, routePath, folderPath } });
  },
);

overlayRouter.delete(
  '/:id',
  requireRole('owner', 'overlay:manage'),
  async (req, res, next) => {
    try {
      const overlay = await deleteOverlay(req.params.id);

      if (!overlay) {
        return res
          .status(404)
          .json({ success: false, error: 'Overlay not found' });
      }

      try {
        unregisterOverlay(overlay.route_path);
      } catch {
        // Already unregistered — not an error
      }

      res.sendStatus(204);
    } catch (e) {
      next(e);
    }
  },
);

overlayRouter.patch(
  '/:id',
  requireRole('owner', 'overlay:manage'),
  async (req, res, next) => {
    const { id } = req.params;
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid updates',
      });
    }

    try {
      const existing = await updateOverlay({ id, ...updates });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, error: 'Overlay not found' });
      }
      // Always unregister the old route first (silent — may not be registered if was inactive)
      try {
        unregisterOverlay(existing.route_path);
      } catch {
        /** void */
      }
      // Only re-register if the overlay is active
      if (existing.active) {
        try {
          registerOverlay({
            routePath: existing.route_path,
            folderPath: existing.folder_path,
            entryFile: existing.entry_file,
          });
        } catch (e) {
          return res.status(400).json({ success: false, error: e.message });
        }
      }
      res.json({ success: true, data: existing });
    } catch (e) {
      next(e);
    }
  },
);

export default overlayRouter;
