# WordPress.org Listing Assets

These files are for the WordPress.org plugin directory SVN `assets/` folder.
They should sit beside `trunk/` and `tags/`, not inside the plugin ZIP.

Files included:

- `banner-772x250.png`
- `banner-1544x500.png`
- `icon-256x256.png`
- `screenshot-1.png` through `screenshot-6.png`

Regenerate them with:

```bash
python3 wordpress-plugin/scripts/generate-wordpress-org-assets.py
```
