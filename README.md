# Piñata Discord Bot 🪅

> **This project is open for sponsorship!** 🚀 Sponsors will enjoy priority support and have a direct line to discuss custom features. Your support can make a huge difference and help us take this project to the next level! 🌟

[Piñata](http://getpinata.com) is a Discord bot crafted to facilitate random pairings among members within a Discord server, aiming to foster a more interconnected and engaging community environment.

- **Energize Your Community:** Boost your Discord server's interaction with Piñata.
- **Ramp Up Engagement:** Increase server activity and engagement using Piñata.
- **Perfect Icebreaker:** Piñata helps newcomers feel integrated from day one.
- **Deepen Ties:** Strengthen bonds and learn more about your members with Piñata.
- **Find New Friends:** Piñata fosters friendships and connections within your server.
- **Unique Dynamics:** Enhance community cohesion with diverse activities through Piñata.
- **Boost Interaction:** Create a welcoming space for all members to engage.

[![Add to Discord](/images/addtodiscord.png)](URL-del-enlace1)
[![Documentation](/images/documentation.png)](URL-del-enlace2)

## Official Website 🌍

> You can use Piñata for free. Feel free to add it to your server on Discord. You can also join [our Discord server](https://discord.gg/XMdrNExKRJ) for help.

[getpinata.com](http://getpinata.com) 🪅

## Installation on your Server

**Customization and Self-Hosting**: Administrators have the freedom to download and modify Piñata’s code to tailor it to their unique preferences and needs. Whether you want to add new features, tweak existing ones, or apply personal touches to make Piñata truly your own. Below, you'll find detailed instructions to guide you through the process of setting up and running Piñata on your own server.

## Prerequisites 🗒️
- Node.js installed on your system.
- A Discord account.

## Installation ⬇️

1. **Clone the Repository:**

```
git clone https://github.com/raulibanez/pinata.git
cd pinata
```

2. **Install Dependencies:**

```
npm install
```


3. **Create and Configure .env File:**
Create a `.env` file in the project root and insert your Discord bot data.
```
PREFIX=!
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
APP_ID=your_app_id
BOT_TOKEN=your_bot_token
MAX_TRIES=5000
NUM_THUMBS=25
NUM_INTROS=10
```

## Discord Bot Setup

1. Go to Discord Developer Portal.
2. Create a new application and name it as you wish (e.g. Piñata).
3. Under the “Bot” tab, create a new bot and retrieve your BOT_TOKEN.
4. Enable the members and presence intents in the bot settings.

## Database & Command Deployment

Before starting the bot for the first time, execute the following scripts to set up the database and deploy slash commands:

```
node scripts/create-database.js
node scripts/deploy_commands.js
```

## Running the Bot

You can start the bot using npm:

```
npm start
```

For production environments, it is recommended to use pm2 as a process manager for Node.js applications.

## License

This project is licensed under the MIT License - see the LICENSE file for details.