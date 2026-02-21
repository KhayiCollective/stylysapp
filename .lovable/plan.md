

# Create Reviewer Test Account and Simplified Testing Instructions

## Overview
Create a dedicated test account for Shopify reviewers and provide simplified, concise testing instructions matching the format shown in the reference image.

## Step 1: Create the test account

Create a user account in the authentication system with:
- **Email:** test@stylysapp.com
- **Password:** ShopifyTest123!

Then run the account bootstrap process to ensure the account has a brand and profile set up, so reviewers land on a functional dashboard immediately after login.

## Step 2: Simplified Testing Instructions

Here are the testing instructions formatted for the Shopify app listing submission:

```text
To test this app:
1. Log in to https://stylysapp.lovable.app/auth
2. Use test credentials: test@stylysapp.com / ShopifyTest123!
3. Click "Connect Shopify" in the dashboard sidebar
4. Enter your development store domain (e.g., my-store.myshopify.com)
5. Approve the permissions and you will be redirected back to the dashboard
6. Navigate to "Catalog" to verify synced products, then "Outfit Generator" to test AI styling
```

## Technical Details

- The test account will be created via the authentication system with email auto-confirmed so reviewers can log in immediately without needing to verify email
- The `handle_new_user` database trigger will automatically create the associated brand, profile, user role, widget config, and default rules
- No code changes are needed -- this is a data-only operation (creating the user account)

