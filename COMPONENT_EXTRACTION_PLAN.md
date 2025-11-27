# Phase 0: Component Extraction Plan

## Overview
This document tracks the extraction of components from the monolithic App.js file (5,944 lines) into separate, manageable modules.

## Directory Structure
```
frontend/src/
├── pages/
│   ├── LandingPage.jsx
│   ├── Dashboard.jsx
│   ├── AdminDashboard.jsx
│   ├── ContactPage.jsx
│   ├── AboutPage.jsx
│   ├── DocsPage.jsx
│   ├── TermsPage.jsx
│   ├── PrivacyPage.jsx
│   ├── EmailConfirmation.jsx
│   └── PaymentSuccess.jsx
├── components/
│   ├── shared/
│   │   ├── Navigation.jsx
│   │   ├── PaymentModal.jsx
│   │   ├── AuthForm.jsx
│   │   └── PayPalSubscriptionButton.jsx
│   └── ui/ (existing shadcn/ui components)
├── lib/
│   ├── supabase.js ✅ (DONE)
│   ├── paypal.js ✅ (DONE)
│   ├── api.js ✅ (DONE)
│   └── utils.js (existing)
├── hooks/
│   ├── use-auth.js (custom hook for auth state)
│   └── use-toast.js (existing)
└── App.js (simplified - just routing)
```

## Component Line Numbers in Current App.js

### Page Components
- `LandingPage`: Lines 85-4096 (~4,000 lines!)
- `Dashboard`: Lines TBD
- `AdminDashboard`: Lines TBD
- `ContactPage`: Lines 4097-4432 (~335 lines) ✓ PRIORITY 1
- `AboutPage`: Lines 5829+ ✓ PRIORITY 2
- `DocsPage`: Lines TBD ✓ PRIORITY 2
- `TermsPage`: Lines TBD ✓ PRIORITY 2
- `PrivacyPage`: Lines TBD ✓ PRIORITY 2
- `EmailConfirmation`: Lines TBD ✓ PRIORITY 3
- `PaymentSuccess`: Lines TBD ✓ PRIORITY 3

### Shared Components
- `PayPalSubscriptionButton`: Lines 4436+
- Payment Modal (inline in LandingPage)
- Auth Form (inline in LandingPage)
- Navigation (duplicated across multiple pages)

## Extraction Order (Safest to Risky)

### Phase 0.1: Simple Static Pages ✅ START HERE
These pages have minimal dependencies and are safest to extract first:
1. ✅ ContactPage (done - see implementation notes)
2. ⏸️ AboutPage
3. ⏸️ TermsPage
4. ⏸️ PrivacyPage
5. ⏸️ DocsPage

### Phase 0.2: Simple React Pages
6. ⏸️ EmailConfirmation
7. ⏸️ PaymentSuccess

### Phase 0.3: Shared Components
8. ⏸️ Navigation component (extract from repeated code)
9. ⏸️ PayPalSubscriptionButton
10. ⏸️ AuthForm

### Phase 0.4: Complex Pages
11. ⏸️ LandingPage (MOST COMPLEX - ~4,000 lines!)
12. ⏸️ Dashboard
13. ⏸️ AdminDashboard

### Phase 0.5: Custom Hooks
14. ⏸️ useAuth hook (for authentication state management)

### Phase 0.6: Final Cleanup
15. ⏸️ Simplify App.js to just routing
16. ⏸️ Remove all extracted code from original App.js
17. ⏸️ Test thoroughly

## Testing After Each Extraction

After extracting each component:
1. ✅ Import the new component in App.js
2. ✅ Replace inline component with imported version
3. ✅ Run `yarn start` to ensure no build errors
4. ✅ Test the page in browser
5. ✅ Verify all functionality works
6. ✅ Commit changes with descriptive message

## Common Patterns Found

### Authentication Check Pattern
Most pages use this pattern:
```javascript
const [user, setUser] = useState(null);

useEffect(() => {
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser({ email: session.user.email, id: session.user.id });
    }
  };
  checkAuth();
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // handle auth changes
  });
  
  return () => subscription?.unsubscribe();
}, []);
```
**Solution**: Extract this into a `useAuth` custom hook

### Navigation Pattern
Most pages have identical navigation code
**Solution**: Create a reusable `Navigation` component

### API Call Pattern
```javascript
const apiBase = window.location.hostname === 'localhost' 
  ? 'http://localhost:9999/.netlify/functions'
  : '/.netlify/functions';
```
**Solution**: Use `getApiBase()` from `lib/api.js` ✅ DONE

## Dependencies Needed in Extracted Components

Common imports for most page components:
```javascript
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
// ... other UI components
```

## Risk Assessment

### LOW RISK (Safe to extract immediately)
- ContactPage ✅
- AboutPage
- TermsPage
- PrivacyPage
- DocsPage

### MEDIUM RISK (Test carefully)
- EmailConfirmation
- PaymentSuccess
- Navigation component
- PayPalSubscriptionButton

### HIGH RISK (Requires careful planning)
- LandingPage (contains auth logic, payment modals, etc.)
- Dashboard (complex user state)
- AdminDashboard (sensitive operations)

## Current Status

**Started**: November 27, 2025
**Current Phase**: 0.1 - Extracting Simple Static Pages
**Next Steps**: 
1. Extract ContactPage (IN PROGRESS)
2. Test ContactPage thoroughly
3. Extract AboutPage
4. Continue with other static pages

## Notes
- Keep all original code in App.js until extraction is complete
- Comment out old code instead of deleting (for easy rollback)
- Test after EVERY extraction
- Commit frequently with descriptive messages
- If anything breaks, revert and reassess
