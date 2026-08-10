FROM node:22-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# The only NEXT_PUBLIC_* value the app reads (NEXT_PUBLIC_API_BASE_URL) is a
# fixed same-origin path, not a per-deployment secret, so it is safe to bake
# in at build time here rather than threading it through as a build arg.
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]