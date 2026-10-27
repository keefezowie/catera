import type { TextInputProps } from "react-native";

/** The same autofill and keyboard props for an auth field in both apps. */
export const authFields = {
  email: { autoComplete: "email", textContentType: "emailAddress", autoCapitalize: "none", autoCorrect: false, keyboardType: "email-address", maxLength: 254 },
  currentPassword: { autoComplete: "current-password", textContentType: "password", autoCapitalize: "none", autoCorrect: false, maxLength: 256 },
  newPassword: { autoComplete: "new-password", textContentType: "newPassword", passwordRules: "minlength: 8;", autoCapitalize: "none", autoCorrect: false, maxLength: 256 },
  phone: { autoComplete: "tel", textContentType: "telephoneNumber", autoCapitalize: "none", autoCorrect: false, keyboardType: "phone-pad", maxLength: 20 },
  name: { autoComplete: "name", textContentType: "name", autoCapitalize: "words", autoCorrect: false, maxLength: 100 },
  code: { autoComplete: "sms-otp", textContentType: "oneTimeCode", autoCapitalize: "none", autoCorrect: false, keyboardType: "number-pad", maxLength: 6 },
} satisfies Record<string, TextInputProps>;
