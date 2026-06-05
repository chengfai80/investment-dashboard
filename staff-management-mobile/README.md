# Staff Management Mobile

Expo mobile app scaffold for the Streamlit-based `staff-management-app`.

## Structure
- `src/context/AuthContext.js` — session persistence and auth
- `src/screens/LoginScreen.js` — login
- `src/screens/StaffLeaveScreen.js` — leave list, summary, delete actions
- `src/screens/FunnelScreen.js` — funnel list, summary, delete actions
- `src/screens/SettingsScreen.js` — logout and API base info
- `src/api/client.js` — API adapter

## Important
The original Streamlit app talks directly to Firestore using a service account JSON. That should not be embedded in a mobile app.

This Expo app expects a backend API with endpoints similar to:
- `POST /auth/login`
- `GET /auth/me`
- `GET /leave`
- `DELETE /leave/:id`
- `GET /funnel`
- `DELETE /funnel/:id`

## To finish it
1. Build the backend API around your Firestore data.
2. Set `EXPO_PUBLIC_API_BASE_URL`.
3. Run `npm install` and `npx expo start`.

## Notes
- The app is structured like your FinTracker mobile app: auth gate + tab navigator + dark UI.
- The current mobile screens are read/delete focused. Add/edit/create flows can be ported next.
