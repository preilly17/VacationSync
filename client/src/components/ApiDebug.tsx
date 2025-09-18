import React, { useState } from "react";

export default function ApiDebug() {
  const [isVisible, setIsVisible] = useState(false);

  if (!isVisible) {
    return (
      <div style={{ marginTop: "2rem" }}>
        <button 
          onClick={() => setIsVisible(true)}
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Show API Debug Info
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3>API Debug Information</h3>
        <button 
          onClick={() => setIsVisible(false)}
          style={{
            padding: "0.25rem 0.5rem",
            backgroundColor: "#6b7280",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Hide
        </button>
      </div>
      
      <div style={{ fontSize: "0.875rem" }}>
        <p><strong>Backend URL:</strong> {window.location.origin}</p>
        <p><strong>Environment:</strong> {import.meta.env.NODE_ENV || 'development'}</p>
        <p><strong>API Base:</strong> /api</p>
        <p><strong>Available Endpoints:</strong></p>
        <ul style={{ marginLeft: "1rem" }}>
          <li>GET /api/health - Health check</li>
          <li>GET /api/search/flights - Flight search</li>
          <li>GET /api/search/hotels - Hotel search</li>
          <li>GET /api/search/activities - Activity search</li>
        </ul>
      </div>
    </div>
  );
}