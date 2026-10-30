# Daily Dose Tracker

This package is ready for GitHub Pages or any static web host.

## Files

- `index.html` — page structure
- `styles.css` — desktop/mobile responsive design
- `app.js` — dose logging, editing, progress, pill stock, calendar history, local storage, JSONBin sync, export, dark mode
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

## Pill supply

In **Settings → Pill supply**, set the strength of each pill once, then type how many pills you bought in **Add bought pills** and press **Add**. The pills are added on top of your **Current pills**, which is read-only and goes down with every dose you log. The tracker divides your planned daily dose by the pill strength to get pills per day, so 90 pills of 10 mg at 30 mg/day reads as 30 days of stock. Once 7 days or less remain, a warning banner stays pinned to the top of the Home screen while you scroll.

## Cloud sync

Open **Backup & Sync** and enter your JSONBin `X-Master-Key` and Bin ID. Local storage remains the primary copy, so the tracker still works without JSONBin.

## Important

This tracker only calculates progress from the values entered by the user. It does not determine an appropriate medical dose or treatment target.
