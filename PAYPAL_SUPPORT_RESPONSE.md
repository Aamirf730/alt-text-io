# PayPal Support Request - Integration Details

## 1. Integration Details

### Full PayPal SDK Script Tag

The PayPal SDK is loaded dynamically in our React application. The script tag is:

```html
<script src="https://www.paypal.com/sdk/js?client-id=AVTK06-gEyIyDGX1uDDrHTkieLGx3znY8iTUkgn_u_l6FrQ9VEMHIdn6ZPvm5NXuOlcr-rwmylPcs24v&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
```

**Parameters:**
- `client-id`: `AVTK06-gEyIyDGX1uDDrHTkieLGx3znY8iTUkgn_u_l6FrQ9VEMHIdn6ZPvm5NXuOlcr-rwmylPcs24v`
- `vault=true`: Required for subscriptions
- `intent=subscription`: Specifies subscription intent
- `data-sdk-integration-source`: `button-factory`

### PayPal Button Integration Code

Our subscription button implementation uses PayPal's native JavaScript SDK with the `createSubscription` method:

```javascript
// PayPal Subscription Button Component
const PayPalSubscriptionButton = ({ planId, planName, paypalPlanId, onSuccess, onError }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const buttonContainerRef = React.useRef(null);

  useEffect(() => {
    // Load PayPal SDK script if not already loaded
    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
      script.async = true;
      script.setAttribute('data-sdk-integration-source', 'button-factory');
      script.onload = () => {
        setScriptLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load PayPal SDK');
        onError?.({ message: 'Failed to load PayPal SDK. Please refresh the page.' });
      };
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    if (!scriptLoaded || !window.paypal || !buttonContainerRef.current) return;

    // Clear any existing buttons
    buttonContainerRef.current.innerHTML = '';

    // Render PayPal subscription button using native SDK
    window.paypal.Buttons({
      style: {
        shape: 'pill',
        color: 'blue',
        layout: 'vertical',
        label: 'subscribe'
      },
      createSubscription: function(data, actions) {
        console.log('Creating PayPal subscription for plan:', paypalPlanId);
        return actions.subscription.create({
          plan_id: paypalPlanId
        });
      },
      onApprove: async function(data, actions) {
        try {
          setIsLoading(true);
          console.log('PayPal subscription approved:', data);
          console.log('Subscription ID:', data.subscriptionID);

          // Get user session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            throw new Error('Please sign in to continue');
          }

          // Determine API base URL
          let apiBase;
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            apiBase = process.env.REACT_APP_API_BASE || 'http://localhost:9999/.netlify/functions';
          } else {
            apiBase = '/.netlify/functions';
          }

          // Complete the subscription on our backend
          const response = await fetch(`${apiBase}/complete-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              subscriptionId: data.subscriptionID,
              planId: planId
            })
          });

          const result = await response.json();
          
          if (!response.ok) {
            throw new Error(result.error || 'Subscription completion failed');
          }

          console.log('Subscription completed successfully:', result);
          onSuccess?.();
        } catch (error) {
          console.error('Subscription completion error:', error);
          onError?.(error);
        } finally {
          setIsLoading(false);
        }
      },
      onError: function(err) {
        console.error('PayPal button error:', err);
        setIsLoading(false);
        onError?.({ message: err.message || 'PayPal subscription failed. Please try again.' });
      },
      onCancel: function(data) {
        console.log('PayPal subscription cancelled:', data);
        setIsLoading(false);
        toast.info('Subscription cancelled');
      }
    }).render(buttonContainerRef.current);
  }, [scriptLoaded, paypalPlanId, planId, onSuccess, onError]);

  return (
    <div className="w-full">
      <div ref={buttonContainerRef} id={`paypal-button-container-${paypalPlanId}`}></div>
    </div>
  );
};
```

**Key Points:**
- We use `actions.subscription.create()` with `plan_id` parameter
- The `plan_id` values are:
  - Tier 1: `P-8R4278588L5455645NEMOH6A`
  - Tier 2: `P-5XP84993MM234080GNEMOTRQ`
  - Tier 3: `P-2DC95956TS8763323NEMOWJQ`
- Button style: `shape: 'pill'`, `color: 'blue'`, `layout: 'vertical'`, `label: 'subscribe'`

### Backend Subscription Creation (Alternative Method)

We also have a backend function that creates subscriptions via PayPal API. This is used as an alternative flow:

**Endpoint:** `/.netlify/functions/create-payment`

**Method:** POST

**Request Body:**
```json
{
  "planId": "tier1",
  "userId": "user-id-from-auth"
}
```

**Response:**
```json
{
  "approvalUrl": "https://www.paypal.com/webapps/billing/subscriptions?ba_token=...",
  "subscriptionId": "I-..."
}
```

## 2. Environment Information

### Live Website URL

**Production URL:** https://www.alt-text.pro

**Issue Reproduction:**
1. Navigate to https://www.alt-text.pro
2. Click "Get Started" or "Sign Up"
3. Create an account or sign in
4. Navigate to the pricing page
5. Click "Subscribe" on any tier (Tier 1, Tier 2, or Tier 3)
6. Click the PayPal subscription button
7. **Issue:** The flow redirects to a one-time payment URL instead of a subscription flow

### Plan IDs in Use

- **Tier 1 Plan ID:** `P-8R4278588L5455645NEMOH6A`
- **Tier 2 Plan ID:** `P-5XP84993MM234080GNEMOTRQ`
- **Tier 3 Plan ID:** `P-2DC95956TS8763323NEMOWJQ`
- **Product ID:** `PROD-51S62165VB572643N`

All plans are verified as `ACTIVE` status in PayPal and linked to the same product ID.

## 3. Account and Setup

### PayPal Account Email

**Please provide:** [TO BE FILLED BY USER - The PayPal account email associated with the integration]

### PayPal Environment

- **Environment:** Production
- **Client ID:** `AVTK06-gEyIyDGX1uDDrHTkieLGx3znY8iTUkgn_u_l6FrQ9VEMHIdn6ZPvm5NXuOlcr-rwmylPcs24v`
- **API Base URL:** `https://api-m.paypal.com`

### Additional Context

**Issue Description:**
When users click the PayPal subscription button, they are redirected to a one-time payment URL (`https://www.paypal.com/webapps/hermes?...`) instead of the subscription approval URL (`https://www.paypal.com/webapps/billing/subscriptions?...`). This causes the subscription flow to fail and shows a "sorry" message.

**What We've Verified:**
1. ✅ Plans are created and ACTIVE in PayPal
2. ✅ Plans are linked to the correct product ID
3. ✅ SDK script tag includes `vault=true` and `intent=subscription`
4. ✅ Button uses `actions.subscription.create()` with correct `plan_id`
5. ✅ Backend subscription creation returns correct approval URL format
6. ✅ All plan IDs are correctly configured

**Console Errors Observed:**
- `selectedFuturePaymentInstrument does not exist, fallback to default logic`
- Cookie rejection for `__cf_bm` on PayPal domain
- XHR POST to `/webapps/hermes/api/checkout/.../session/create` returns 400

**Files:**
- Frontend: `frontend/src/App.js` (lines 4568-4697)
- Backend: `netlify-functions/create-payment.js`
- Backend: `netlify-functions/activate-subscription.js`

---

**Note:** Please fill in the PayPal account email in section 3 before sending this to PayPal support.

