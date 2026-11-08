# Pencil forms for WordPress

1. Copy this directory into `./wp-content/plugins/pencil` on your WordPress site, then activate **Pencil forms** in Plugins. No theme changes are needed.
2. In `wp-config.php`, before WordPress loads, set the Pencil installation origin:

   ```php
   define('PENCIL_INSTALLATION_URL', 'https://forms.example.invalid');
   ```

   Use your actual Pencil origin, with no path, query, fragment or credentials. HTTPS is required except for a loopback development installation. The URL is administrator configuration, so post authors cannot use a shortcode to execute scripts from another site.
3. In Pencil, open Settings and add the exact WordPress origin to the allowed embed hosts, including its port when present. Publish the Pencil form.
4. Add a Shortcode block to a WordPress page and publish it:

   ```text
   [pencil flow="customer-feedback"]
   ```

   Replace `customer-feedback` with the published form's slug. The shortcode accepts only `flow`, using lowercase letters, digits and single separating hyphens, up to 120 characters. Missing or invalid values and unsupported attributes render an unavailable message and load no script.

The shortcode uses Pencil's asynchronous inline embed. The frame keeps the existing opaque sandbox, height updates and answer-free loaded and completed events. Responses are stored by Pencil; WordPress receives no answers. An unlisted WordPress host is refused by Pencil before the form renders. WordPress must permit the script to load and send its origin as the Referer; a policy that removes that header causes safe refusal.

Other shortcode modes and the DIST-021 forwarding, fixed-value, `hidden` and GA options are not implemented here. Existing campaign handling in the shared script is unchanged. Webflow and Squarespace installation instructions remain separate work.

The existing script embed browser journey installs this actual plugin in disposable WordPress and MariaDB containers, publishes native shortcode pages and checks collection and refusal. It requires Docker with Compose. Run `pnpm exec playwright test tests/e2e/script-embed.spec.ts --workers=1` from the checkout; the lifecycle helper removes its containers and volumes on success or failure.
