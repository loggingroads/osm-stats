FROM node:4.2

RUN curl -sSL https://github.com/loggingroads/osm-stats-api/archive/loggingroads.tar.gz \
  | tar -v -C /usr/src -xz

WORKDIR /usr/src/osm-stats-api-loggingroads
RUN npm install

CMD ["npm", "start"]
