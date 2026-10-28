# Operator-approved scanner authentication

[한국어](scanner-authentication.ko.md) | [English](scanner-authentication.md)

Security teams can register a dedicated inspection token in their own site's WAF. This feature does not automatically remove access restrictions on external sites.

## Configure the app

1. Open **Settings → Authenticator**.
2. Enter an exact HTTPS origin, such as `https://example.com`, and a path such as `/boards`. Ports and subdomains are separate scopes.
3. Choose **Generate token → Copy token** and register the 32-byte random token in your WAF. Existing tokens must contain 32–256 letters, digits, hyphens or underscores.
4. Select a client lifetime of 1, 4, 8 or 24 hours and apply the credentials.
5. Scan a URL within the registered path and inspect WAF events for a rule match. “Registered” does not establish server acceptance.

The header is `X-Chickadee-Token`. `/boards` includes `/boards/...`, not `/boardsevil`. HTML, scripts, CSS and images use the same scope. Credentials are not sent over HTTP, to another origin, outside the path, or with methods other than GET/HEAD. Automatic redirect following is disabled; subsequent requests are checked again. Image collection continues to reject HTTP redirects.

Out-of-scope assets may remain blocked. Operators must choose a scope that includes required resources. The credential path controls header delivery, not the crawler's navigation scope.

Credentials stay in backend memory, with at most 20 origins. Registering an existing origin replaces it. An expired registration or out-of-scope entry URL prevents scan startup. Expiry during a scan stops subsequent credential delivery. Restarting clears credentials, so this is not persistent authentication for unattended schedules. Separate AI exploration and login windows do not receive the header.

## Example Cloudflare condition

Replace the host, path, documentation IP and token placeholder. Prefer a fixed scanner IP in addition to the token. Removing the IP condition permits any holder of the token to match. User-Agent is not proof of identity.

```text
(ssl and http.host eq "example.com"
 and http.request.method in {"GET" "HEAD"}
 and (http.request.uri.path eq "/boards" or starts_with(http.request.uri.path, "/boards/"))
 and ip.src eq 203.0.113.10
 and any(http.request.headers["x-chickadee-token"][*] eq "REPLACE_WITH_GENERATED_TOKEN"))
```

Apply a Skip action only to the bot checks that need an exception. Check rule order and the actual challenge source. Retain login permissions and rate limits; do not skip all managed WAF rules. Checking only for header presence is insufficient.

**Bot Fight Mode cannot be exempted with custom Skip rules.** Confirm that your product supports exceptions, such as Super Bot Fight Mode, and review plan-specific options. [Bot Fight Mode limitations](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/#limitations), [Skip options](https://developers.cloudflare.com/waf/custom-rules/skip/options/).

## Validate and revoke

- Test the allowed entry page, subsequent pages and required images with the correct token.
- Confirm that missing/wrong tokens, other IPs and out-of-scope paths do not match the exception.
- Client expiry does **not** revoke the server token. Remove credentials in the app and disable the WAF rule or rotate its token after inspection.
- Treat tokens as shared secrets: restrict WAF configuration and origin header logs. Do not reflect tokens in response content or diagnostic pages. OS clipboard history may retain copies.
- Request error messages are redacted, but server content reflecting the token can still be collected.

This version does not implement mTLS, certificate issuance, automatic WAF configuration or proof of site ownership. The operator authorizes and configures the server-side scope.
