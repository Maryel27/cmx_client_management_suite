import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SERVER_URL } from "../lib/constants";
import bcrypt from "bcryptjs";
import UserService from "../../service/UserService";
import pkg from "../../../package.json";

const OtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const APP_VERSION = pkg.version;

  const emailAddress =
    location.state?.emailAddress || localStorage.getItem("pendingEmail");

  const requestedDateTime =
    location.state?.requestedDateTime ||
    localStorage.getItem("pendingRequestedAt");
  const expiryDateTime =
    location.state?.expiryDateTime || localStorage.getItem("pendingExpiryAt");

  // If email was passed via route state, persist it
  if (location.state?.emailAddress) {
    localStorage.setItem("pendingEmail", location.state.emailAddress);
  }

  const [enteredOtp, setEnteredOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (!emailAddress) {
      setError("Missing email. Please restart the login.");
      return;
    }
    if (!enteredOtp) {
      setError("Please enter the OTP.");
      return;
    }
    if (!expiryDateTime) {
      setError("Session expired. Please request a new OTP.");
      return;
    }

    const now = new Date();
    const expiry = new Date(expiryDateTime);
    if (isNaN(expiry.getTime())) {
      setError("Invalid OTP session. Please request a new OTP.");
      return;
    }
    if (now > expiry) {
      setError("OTP has expired. Please request a new one.");
      return;
    }

    const hashedOtp = localStorage.getItem("pendingOtpHashed");
    if (!hashedOtp) {
      setError("No OTP found. Please try again.");
      return;
    }

    const isMatch = await bcrypt.compare(enteredOtp, hashedOtp);
    if (!isMatch) {
      setError("Incorrect OTP. Please try again.");
      return;
    }

    setSuccess("OTP verified successfully!");
    localStorage.removeItem("pendingOtpHashed");

    try {
      // ✅ Existing-user-only flow: get the pending user from UserService
      const pendingUser = UserService.getPendingUser?.();

      if (!pendingUser) {
        setError(
          "User session data is missing. Please start the login process again."
        );
        return;
      }

      const {
        userid,
        userEmail,
        firstName,
        lastName,
        fullName,
        userLevel,
        userStatus,
      } = pendingUser;

      // Optional: second-layer check for active status
      if (userStatus && userStatus.toLowerCase() !== "active") {
        setError("This account is not active. Please contact your administrator.");
        return;
      }

      // ✅ Finalize login for existing user
      UserService.loginUser({
        userId: userid,
        email: userEmail || emailAddress,
        firstname: firstName || fullName || "",
        lastname: lastName || "",
        providerId: emailAddress,
        userLevel,
        userStatus,
      });
      
      // Cleanup OTP-related state
      localStorage.removeItem("pendingEmail");
      localStorage.removeItem("pendingRequestedAt");
      localStorage.removeItem("pendingExpiryAt");

      // Optional: clear pendingUser via service if implemented
      if (UserService.clearPendingUser) {
        UserService.clearPendingUser();
      }

      // Redirect to main app
      navigate("/ClientRoster", {
        replace: true,
      });
    } catch (err) {
      console.error("❌ OTP Verification Error:", err);
      setError("Could not complete verification. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#061326]">
      {/* Glow accent behind card */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-72 h-72 bg-[#00a1c9]/15 rounded-full blur-3xl absolute -top-16 -left-10" />
        <div className="w-72 h-72 bg-[#f58220]/10 rounded-full blur-3xl absolute bottom-0 right-0" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/10 border border-white/30 backdrop-blur-lg text-white px-10 py-7 md:px-10 md:py-7 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] w-full max-w-sm">
          <h2 className="text-lg font-bold text-white mb-4">Verify OTP</h2>

          <p className="text-sm mb-4 text-white/80">
            An OTP has been sent to <strong>{emailAddress}</strong>. Please enter
            it below to sign in.
          </p>

          <input
            type="text"
            placeholder="- - - - - -"
            maxLength={6}
            value={enteredOtp}
            onChange={(e) => {
              setEnteredOtp(e.target.value);
              if (error || success) {
                setError("");
                setSuccess("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleVerifyOtp();
              }
            }}
            className="w-full border border-white/20 bg-white/10 text-white px-3 py-2 rounded text-center text-lg tracking-widest placeholder-white/50 focus:outline-none"
          />

          {error && (
            <p className="text-red-400 text-sm mt-2 text-center bg-white/10 rounded py-1 px-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-400 text-sm mt-2 text-center bg-white/10 rounded py-1 px-2">
              {success}
            </p>
          )}

          <button
            onClick={handleVerifyOtp}
            className="w-full mt-4 bg-[#0084a4] hover:bg-[#015368] text-white py-2 rounded"
          >
            Verify OTP
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-2 left-0 w-full px-4">
        <p className="text-[10px] text-white text-center">
          © 2025 CMX Client Management Suite v{APP_VERSION}
        </p>
        <p className="text-[10px]  text-white text-center">
          DREAM Dev Ops || Callmax Solutions International All Rights Reserved
        </p>
      </div>

    </div>
  );
};

export default OtpVerification;
