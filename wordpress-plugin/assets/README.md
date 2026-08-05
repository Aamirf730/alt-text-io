# WordPress.org Listing Assets

These files are for the WordPress.org plugin directory SVN `assets/` folder.
They should sit beside `trunk/` and `tags/`, not inside the plugin ZIP.

Files included:

- `banner-772x250.png`
- `banner-1544x500.png`
- `icon-128x128.png`
- `icon-256x256.png`
- `screenshot-1.png` through `screenshot-6.png`

The listing icons use the actual Alt Text Pro circular logo from `alt-text-pro/assets/images/logo-alt-text-pro.png` rather than the simplified text-only mark.

Regenerate them with:

```bash
python3 wordpress-plugin/scripts/generate-wordpress-org-assets.py
```
