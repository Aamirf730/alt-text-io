# Plugin Deployment Location

## ✅ Single Source of Truth

The WordPress plugin ZIP is kept in **ONE location only**:

```
frontend/public/wordpress-plugin/alt-text-pro-plugin-v1.0.1.zip
```

## 📦 How It Works

1. **Source Location**: `frontend/public/wordpress-plugin/alt-text-pro-plugin-v1.0.1.zip`
   - This is the single source file
   - Contains version 1.0.1 with `auth-validate` endpoint fix

2. **During Build**: 
   - Netlify runs `cd frontend && yarn build`
   - Files from `frontend/public/` are copied to `frontend/build/`
   - Plugin ZIP automatically available at build time

3. **Deployed URL**:
   ```
   https://www.alt-text.pro/wordpress-plugin/alt-text-pro-plugin-v1.0.1.zip
   ```

## 🔧 Updating the Plugin

When you need to update the plugin:

1. **Make changes** to files in `wordpress-plugin/alt-text-ai/`
2. **Rebuild ZIP**:
   ```bash
   cd wordpress-plugin
   ./build-plugin.sh
   ```
3. **Copy to public folder**:
   ```bash
   cp alt-text-pro-plugin-v1.0.1.zip ../frontend/public/wordpress-plugin/
   ```
4. **Deploy** - Netlify will automatically include it in the build

## 📋 Important Notes

- ✅ Keep plugin ZIP only in `frontend/public/wordpress-plugin/`
- ❌ Do NOT manually add to `frontend/build/` (auto-generated)
- ❌ Do NOT keep ZIP in `wordpress-plugin/` folder (source only)

The `build` folder is generated automatically during deployment, so the plugin will be available at the deployed URL.

