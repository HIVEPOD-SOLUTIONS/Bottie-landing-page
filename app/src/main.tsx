import { createRoot } from "react-dom/client";
import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";
import App from "./App.tsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.tsx";
import { NotificationProvider } from "./contexts/NotificationContext.tsx";
import "./index.css";

const client = createThirdwebClient({
  clientId: "c0016c054a796a6fa54b18dd24ed5f77",
});

const path = window.location.pathname.replace(/\/$/, ""); // strip trailing slash

createRoot(document.getElementById("root")!).render(
  <ThirdwebProvider>
    <NotificationProvider>
      {path === "/privacy" ? (
        <PrivacyPolicy />
      ) : (
        <App thirdwebClient={client} />
      )}
    </NotificationProvider>
  </ThirdwebProvider>
);
