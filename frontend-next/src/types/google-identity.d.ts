interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  use_fedcm_for_prompt?: boolean;
  ux_mode?: "popup" | "redirect";
}

interface GoogleButtonConfiguration {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      cancel: () => void;
      initialize: (configuration: GoogleIdConfiguration) => void;
      renderButton: (element: HTMLElement, configuration: GoogleButtonConfiguration) => void;
    };
  };
}

interface Window {
  google?: GoogleIdentityServices;
}
