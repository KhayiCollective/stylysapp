
# Add Forgot Password Flow

## What This Does
Adds a "Forgot password?" link on the sign-in page and a dedicated reset password page so users can recover their accounts.

## How It Works
1. On the sign-in form, a "Forgot password?" link appears below the password field
2. Clicking it shows an email input where users enter their email to receive a reset link
3. The reset email links back to a `/reset-password` page where they set a new password
4. After resetting, they're redirected to the dashboard

## Changes

### 1. Update the Auth page (`src/pages/Auth.tsx`)
- Add a "forgot password" view state (login / signup / forgot)
- When in "forgot" mode, show only the email field and a "Send reset link" button
- Call the password reset function and show a success toast
- Add a "Forgot password?" link below the password field (visible only on sign-in)

### 2. Create a Reset Password page (`src/pages/ResetPassword.tsx`)
- New page with a form for entering a new password (with confirmation field)
- Detects the recovery token from the URL
- Calls the update password function to set the new password
- Redirects to the dashboard on success

### 3. Add the reset password function to the auth hook (`src/hooks/useAuth.tsx`)
- Add `resetPassword(email)` -- sends the reset email with redirect URL pointing to `/reset-password`
- Add `updatePassword(newPassword)` -- updates the user's password after clicking the reset link

### 4. Register the new route (`src/App.tsx`)
- Add `/reset-password` as a public route pointing to the new ResetPassword page
