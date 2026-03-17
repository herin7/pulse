function buildPayloadScript(payload) {
  return `<script>
    if (window.opener) {
      window.opener.postMessage(${JSON.stringify(payload)}, '*');
    }
    window.close();
  </script>`;
}

export function buildOauthSuccessPopup(payload) {
  return buildPayloadScript(payload);
}

export function buildOauthErrorPopup(error) {
  return buildPayloadScript({
    type: 'pulse:gmail-error',
    error: String(error),
  });
}
