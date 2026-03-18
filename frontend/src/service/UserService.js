// src/service/UserService.js
import { SERVER_URL } from "../components/lib/constants";

class UserService {
  static BASE_URL = SERVER_URL;

  // Auth is true only after OTP success (manual) or confirmed Google login
  static isAuthenticated() {
    return (
      !!localStorage.getItem("userId") &&
      localStorage.getItem("sessionVerified") === "1"
    );
  }

  // ✅ Save pending user (before OTP verification)
  static setPendingUser(user) {
    if (user) {
      localStorage.setItem("pendingUser", JSON.stringify(user));
    }
  }

  static getPendingUser() {
    const raw = localStorage.getItem("pendingUser");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static clearPendingUser() {
    localStorage.removeItem("pendingUser");
    localStorage.removeItem("pendingOtpHashed");
    localStorage.removeItem("pendingEmail");
  }

  static loginUser({
    userId,
    email,
    firstname = "",
    lastname = "",
    providerId,
    userLevel = "",
    userStatus = "",
  }) {
    const finalId =
      userId || providerId || (email ? `manual_${email}` : undefined);

    if (!finalId) {
      console.warn("loginUser called without a valid userId/providerId/email");
    }

    localStorage.setItem("userId", finalId || "");
    localStorage.setItem("userEmail", email || "");
    localStorage.setItem("userFirstname", firstname || "");
    localStorage.setItem("userLastname", lastname || "");

    // ✅ Keep userLevel and userStatus
    localStorage.setItem("user_access_level", userLevel || "");
    localStorage.setItem("user_status", userStatus || "");

    localStorage.setItem("sessionVerified", "1");

    this.clearPendingUser();

    return finalId;
  }

  static getCurrentUser() {
    const userId = localStorage.getItem("userId");
    const email = localStorage.getItem("userEmail");
    const firstname = localStorage.getItem("userFirstname");
    const lastname = localStorage.getItem("userLastname");
    const user_access_level = localStorage.getItem("user_access_level") || "";
    const user_status = localStorage.getItem("user_status") || "";

    return {
      userId,
      email,
      firstname,
      lastname,
      user_access_level,
      user_status,
    };
  }

  static logout() {
    localStorage.removeItem("userId");
    localStorage.removeItem("sessionVerified");

    localStorage.removeItem("userEmail");
    localStorage.removeItem("userFirstname");
    localStorage.removeItem("userLastname");

    // ✅ Clear user access data
    localStorage.removeItem("user_access_level");
    localStorage.removeItem("user_status");

    this.clearPendingUser();
  }
}

export default UserService;
