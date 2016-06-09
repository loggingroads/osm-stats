FROM node:4.2

RUN npm install -g npm@3.9.2

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/

WORKDIR /opt/app
ADD . /opt/app

CMD ["node", "index.js"]