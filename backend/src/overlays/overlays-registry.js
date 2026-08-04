import express from 'express';
import fs from 'fs';
import path from 'path';

const registry = new Map();

export function registerOverlay({ routePath, folderPath, entryFile }) {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Overlay folder does not exist: ${folderPath}`);
  }

  const entryFilePath = path.join(folderPath, entryFile);
  if (!fs.existsSync(entryFilePath)) {
    throw new Error(`Entry file does not exist: ${entryFilePath}`);
  }

  const staticMw = express.static(folderPath);
  registry.set(routePath, { folderPath, entryFile, staticMw });
}

export function unregisterOverlay(routePath) {
  if (!registry.has(routePath)) {
    throw new Error(`Overlay route not registered: ${routePath}`);
  }
  registry.delete(routePath);
}

export function getAllOverlays() {
  return Array.from(registry.entries()).map(([routePath, v]) => ({
    routePath,
    folderPath: v.folderPath,
  }));
}

export function overlayDispatcher(req, res, next) {
  for (const [routePath, { staticMw, entryFile }] of registry) {
    // Exact match without trailing slash → redirect so relative assets resolve correctly
    if (req.path === routePath) {
      return res.redirect(301, req.path + '/');
    }
    if (req.path.startsWith(routePath + '/')) {
      const remaining = req.url.slice(routePath.length);
      req.url =
        remaining === '/' || remaining === '' ? `/${entryFile}` : remaining;
      return staticMw(req, res, next);
    }
  }
  next();
}
