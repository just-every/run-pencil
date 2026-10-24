# Getting started

Pencil runs on your own computer. Open a terminal (on a Mac, Terminal in Applications → Utilities; on Windows, your WSL2 distribution), copy this line into it and press Enter:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-pencil
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-pencil` does the same.

The line installs `rer`, the Run Edit Run command, clones Pencil into a `run-pencil` folder, installs everything and starts it with a local owner. When it is ready it prints the app's address and a `RER_OPEN` link: open that link on the same computer to arrive signed in at `/setup`, and keep it private, because it signs you in as the owner. This free copy runs only on your computer: it sends no email, and nobody else can open it.

If the installer prints a line that puts `rer` on your PATH, run that line too. To start Pencil again later, run the same line from the same folder, or `cd run-pencil && rer dev`. `rer dev --stop` stops it.

Next: [Install and run locally](install.md) covers your local owner, setup and upgrades, and [Hosting on Cloudflare](hosting.md) puts Pencil online.
