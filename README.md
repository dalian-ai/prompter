
**Prompter** is a web UI for LLM prompt engineering. *Prompter* is under development, you can access a demo at https://prompter.conversabile.com

Available features:

* Parametrized prompts
* Prompt sharing via permalink
* In-page predictions
* Integration with OpenAI and Ollama prediction services 
* Multi-prompt sequences

Feature brainstorming:

* External services integrations
* Output JSON parsing and schema validation
* Automatic REST endpoints around prompts
* User management with access levels and teams

# Run with Docker

A public Docker image is available for Prompter. After defining your `.env` configuration (start by copying `.env.default`) run it with:

    docker run --name prompter -p 3333:3000 --env-file='.env' -e ORIGIN='http://localhost:3333' conversabile/prompter:latest

The application is now running at http://localhost:3333. For saved prompts to be persisted, the `/data` folder should be mounted as a volume

# Deploy with Docker Compose

After defining your `.env` configuration (start by copying `.env.default`), prompter can be integrated in a docker-compose deployment as follows:

```yaml
version: '3'
services:
  prompter:
    image: conversabile/prompter:latest
    environment:
      - PUBLIC_SITE_NAME=Prompter
    volumes:
      - ./prompter/data:/data
    ports:
      - 3333:3000
    restart: always
```

A reverse proxy can then be configured, redirecting incoming traffic on local port `3333`.

# Development

## Run locally

After defining your `.env` configuration (start by copying `.env.default`), Prompter can be launched locally as follows:

```sh
cd prompter_app
npm install
npm run build
set -a            
source .env
set +a
ORIGIN=http://localhost:3000 node build/index.js
```

The application is now available at `http://localhost:3000`

For development it is useful to spawn a dev server to watch for changes and automatically rebuild. This can be done as follows (`.env` is loaded automatically):

```sh
cd prompter_app
npm run dev
```

The app will be available at http://localhost:5173/

## Docker Build and Publish

    docker build . -t conversabile/prompter:latest
    docker push conversabile/prompter:latest

    docker tag conversabile/prompter:latest conversabile/prompter:<VERSION>
    docker push conversabile/prompter:<VERSION>
