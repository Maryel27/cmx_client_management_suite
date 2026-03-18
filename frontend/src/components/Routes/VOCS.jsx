import React, { useEffect, useMemo, useState } from "react";
import { SERVER_URL } from "../lib/constants";
import ClientSuiteHeader from "../common/ClientSuiteHeader";

const VOCS = () => {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [showEmailPanel, setShowEmailPanel] = useState(false);

  const [emailForm, setEmailForm] = useState({
    month: "",
    client: "",
    email: "",
    agentName: "",
  });

  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState("idle");
  const [emailMessage, setEmailMessage] = useState("");

  const [clients, setClients] = useState([]);

  const fetchResponses = async () => {
    try {
      setLoading(true);

      const res = await fetch(`${SERVER_URL}/api/voc-responses`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch VOC responses");
      }

      setResponses(data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error loading responses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResponses();
  }, []);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/clients`);
        const data = await res.json();
        setClients(data);
      } catch (err) {
        console.error("Error fetching clients:", err);
      }
    };

    fetchClients();
  }, []);

  const filteredResponses = useMemo(() => {
    if (!searchTerm.trim()) return responses;

    const term = searchTerm.toLowerCase();

    return responses.filter((row) => {
      const haystack = [row.name, row.company, row.email, row.tasks]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [responses, searchTerm]);

  const ratingColor = (score) => {
    if (score >= 4) return "bg-blue-100 text-blue-700"; // Good
    if (score === 3) return "bg-yellow-100 text-yellow-700"; // Neutral
    return "bg-red-100 text-red-700"; // Poor
  };

  const handleEmailChange = (e) => {
    const { name, value } = e.target;
    setEmailForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();

    const missing = [];
    if (!emailForm.month) missing.push("Month");
    if (!emailForm.client) missing.push("Client");
    if (!emailForm.email) missing.push("Email");
    if (!emailForm.agentName) missing.push("Agent Name");

    if (missing.length) {
      setEmailError(`Please fill required fields: ${missing.join(", ")}`);
      return;
    }

    setEmailError("");
    setEmailLoading(true);

    try {
      const res = await fetch(`${SERVER_URL}/api/send-survey-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });

      const data = await res.json();

      if (res.ok) {
        setEmailStatus("success");
        setEmailMessage(data.message || "Survey email sent successfully.");

        // ✅ CLOSE EMAIL MODAL IMMEDIATELY
        setShowEmailPanel(false);

        // ✅ RESET FORM
        setEmailForm({
          month: "",
          client: "",
          email: "",
          agentName: "",
        });
      } else {
        setEmailStatus("error");
        setEmailMessage(data.message || "Failed to send email.");
        // ✅ CLOSE EMAIL MODAL IMMEDIATELY
        setShowEmailPanel(false);
      }
    } catch (err) {
      setEmailStatus("error");
      setEmailMessage("Error sending email.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#f5f7fa] flex flex-col">
      <ClientSuiteHeader />

      <main className="flex-1 flex overflow-hidden mb-2">
        {/* Left panel */}
        <aside className="w-64 border-r border-gray-200 bg-white/80 backdrop-blur-sm p-4 space-y-4">
          <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            VOC Survey
          </h2>

          <p className="text-xs text-gray-600">Total Responses</p>

          <div className="text-2xl font-semibold text-[#003b5c]">
            {responses.length}
          </div>
        </aside>

        {/* Main content */}
        <section className="flex-1 flex flex-col">
          <div className="px-5 pt-4 pb-3 border-b border-gray-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* LEFT */}
              <div>
                <h1 className="text-sm font-semibold text-gray-900">
                  VOC Survey Responses
                </h1>

                <p className="text-[11px] text-gray-500">
                  Customer Voice of Client feedback responses
                </p>
              </div>

              {/* RIGHT (Search + Button) */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="w-full md:w-72">
                  <input
                    type="text"
                    placeholder="Search responses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-9 rounded-full pl-4 pr-10 text-xs bg-white border border-[#00a1c9] focus:outline-none focus:ring-2 focus:ring-[#00a1c9]"
                  />
                </div>

                <button
                  onClick={() => setShowEmailPanel(true)}
                  className="h-9 px-4 rounded-full text-xs bg-[#00a1c9] text-white hover:bg-[#008bb1] whitespace-nowrap"
                >
                  Send Survey Email
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 px-5 pb-4">
            <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden h-full">
              {loading ? (
                <div className="py-10 text-center text-xs text-gray-400">
                  Loading responses...
                </div>
              ) : error ? (
                <div className="py-10 text-center text-xs text-red-500">
                  {error}
                </div>
              ) : (
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 border-b sticky top-0 z-10">
                      <tr>
                        {[
                          "Name",
                          "Company",
                          "Email",
                          "Tasks",
                          "Satisfaction",
                          "Recommend",
                          "Communication",
                          "Collaboration",
                          "Consistency",
                          "Attachment",
                        ].map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2 text-left font-semibold text-xs text-gray-700 uppercase"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-50">
                      {filteredResponses.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-4 py-10 text-center text-gray-400"
                          >
                            No responses found
                          </td>
                        </tr>
                      )}

                      {filteredResponses.map((row) => (
                        <tr key={row.id} className="hover:bg-[#e1edf5]/60">
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {row.name}
                          </td>

                          <td className="px-4 py-2 text-gray-700">
                            {row.company}
                          </td>

                          <td className="px-4 py-2 text-gray-700">
                            {row.email}
                          </td>

                          <td className="px-4 py-2 text-gray-700 max-w-xs truncate">
                            {row.tasks}
                          </td>

                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${ratingColor(row.satisfaction)}`}
                            >
                              {row.satisfaction}
                            </span>
                          </td>

                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] ${ratingColor(row.recommend)}`}
                            >
                              {row.recommend}
                            </span>
                          </td>

                          <td className="px-4 py-2">{row.communication}</td>

                          <td className="px-4 py-2">{row.collaboration}</td>

                          <td className="px-4 py-2">{row.consistency}</td>

                          <td className="px-4 py-2">
                            {row.attachment_files
                              ? row.attachment_files
                                  .split(",")
                                  .map((fileKey, i) => {
                                    const fileName = fileKey.split("/").pop();

                                    return (
                                      <button
                                        key={i}
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(
                                              `${SERVER_URL}/api/voc-attachment?key=${encodeURIComponent(fileKey)}`,
                                            );

                                            const data = await res.json();

                                            if (data.success) {
                                              window.open(data.url, "_blank");
                                            }
                                          } catch (err) {
                                            console.error(
                                              "File open error:",
                                              err,
                                            );
                                          }
                                        }}
                                        className="block text-[#00a1c9] underline text-xs"
                                      >
                                        {fileName}
                                      </button>
                                    );
                                  })
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* EMAIL RESULT MODAL */}
          {emailStatus !== "idle" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full
          ${emailStatus === "success" ? "bg-emerald-100" : "bg-red-100"}`}
                  >
                    {emailStatus === "success" ? (
                      <span className="text-lg text-emerald-700 animate-bounce">
                        ✔
                      </span>
                    ) : (
                      <span className="text-lg text-red-700 animate-[shake_0.3s_ease-in-out_2]">
                        !
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {emailStatus === "success"
                        ? "Email Sent Successfully"
                        : "Email Sending Failed"}
                    </h3>

                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {emailMessage}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEmailStatus("idle");

                      if (emailStatus === "success") {
                        setShowEmailPanel(false); // ✅ close form modal
                        setEmailForm({
                          month: "",
                          client: "",
                          email: "",
                          agentName: "",
                        }); // ✅ reset form
                      }
                    }}
                    className={`h-8 px-4 rounded-lg text-[11px] font-medium
          ${
            emailStatus === "success"
              ? "bg-[#003b5c] text-white hover:bg-[#002a40]"
              : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
                  >
                    {emailStatus === "success" ? "Close" : "Back"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* EMAIL MODAL */}
          {showEmailPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 relative">
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-gray-800">
                    Send Survey Email
                  </h2>
                  <button
                    onClick={() => setShowEmailPanel(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {/* Error Message */}
                {emailError && (
                  <p className="text-red-500 text-xs mb-3">{emailError}</p>
                )}

                {/* Form */}
                <form
                  onSubmit={handleEmailSubmit}
                  className="space-y-4 text-xs"
                >
                  {/* Month */}
                  <div>
                    <label>Month</label>
                    <select
                      name="month"
                      value={emailForm.month}
                      onChange={handleEmailChange}
                      className="w-full border rounded px-2 py-1.5"
                    >
                      <option value="">Select</option>
                      {[
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                      ].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Client */}
                  <div>
                    <label>Client</label>
                    <select
                      name="client"
                      value={emailForm.client}
                      onChange={handleEmailChange}
                      className="w-full border rounded px-2 py-1.5"
                    >
                      <option value="">Select</option>
                      {clients.map((c, i) => (
                        <option key={i} value={c.ACCOUNT}>
                          {c.ACCOUNT}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Email */}
                  <div>
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={emailForm.email}
                      onChange={handleEmailChange}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>

                  {/* Agent Name */}
                  <div>
                    <label>Agent Name</label>
                    <input
                      name="agentName"
                      value={emailForm.agentName}
                      onChange={handleEmailChange}
                      className="w-full border rounded px-2 py-1.5"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowEmailPanel(false)}
                      className="px-3 py-1 bg-gray-300 rounded"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={emailLoading}
                      className={`px-4 py-1.5 rounded text-white ${
                        emailLoading
                          ? "bg-gray-300"
                          : "bg-[#003b5c] hover:bg-[#002a40]"
                      }`}
                    >
                      {emailLoading ? "Sending..." : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default VOCS;
