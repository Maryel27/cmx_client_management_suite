import React from "react";
import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import OauthLogin from "./components/Routes/OauthLogin";
import ClientRoster from "./components/Routes/ClientRosterPage";
import ClientEscalations from "./components/Routes/ClientEscalationsPage";
import VOCS from "./components/Routes/VOCS";
import Register from "./components/Routes/Register";
import OtpVerification from "./components/common/OtpVerification";
import UserService from "./service/UserService";

// ✅ Route Guard: Checks if user is authenticated
function RequireAuth() {
  const location = useLocation();
  const authed = UserService.isAuthenticated();
  return authed ? (
    <Outlet />
  ) : (
    <Navigate to="/OauthLogin" replace state={{ from: location }} />
  );
}

// ✅ Route Guard: Prevents access if access level is "User"
function RequireAdminOrHigher() {
  const location = useLocation();
  const accessLevel = localStorage.getItem("user_access_level");

  return accessLevel !== "User" ? (
    <Outlet />
  ) : (
    <Navigate to="/ClientEscalations" replace state={{ from: location }} />
  );
}

// ✅ Routes
export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<OauthLogin />} />
      <Route path="/OauthLogin" element={<OauthLogin />} />
      <Route path="/Register" element={<Register />} />
      <Route path="/OTP-SECURE" element={<OtpVerification />} />

      {/* Protected Routes */}
      <Route element={<RequireAuth />}>
        {/* Only allow non-"User" roles to access ClientRoster */}
        <Route element={<RequireAdminOrHigher />}>
          <Route path="/ClientRoster" element={<ClientRoster />} />
          <Route path="/VOCS" element={<VOCS />} />
        </Route>

        {/* Accessible by all authenticated users */}
        <Route path="/ClientEscalations" element={<ClientEscalations />} />
      </Route>
    </Routes>
  );
}
