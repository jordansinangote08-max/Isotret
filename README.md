# Daily Dose Tracker

This package is ready for GitHub Pages or any static web host.

## Files

- `index.html` — page structure
- `styles.css` — desktop/mobile responsive design
- `app.js` — dose logging, editing, progress, calendar history, local storage, JSONBin sync, export, dark mode
- `manifest.webmanifest` — installable PWA metadata
- `sw.js` — offline app shell cache
- `icons/icon.svg` — source app icon
- `icons/icon-192.png` — PWA / iPhone icon
- `icons/icon-512.png` — large PWA icon

## GitHub Pages

1. Upload all files and the `icons` folder to the root of your repository.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your main branch and `/ (root)`.
5. Save.

## Existing data

The app automatically checks the old local-storage key `doseTrackerData_v1`, so data from the earlier version can migrate to this version on the same browser/device.

## Cloud sync

Open **Backup & Sync** and enter your JSONBin `X-Master-Key` and Bin ID. Local storage remains the primary copy, so the tracker still works without JSONBin.

## Important

This tracker only calculates progress from the values entered by the user. It does not determine an appropriate medical dose or treatment target.
