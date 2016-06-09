FROM node:4.2

RUN npm install -g npm@3.9.2
RUN ssh-keyscan -H github.com >> ~/.ssh/known_hosts

ADD package.json /tmp/package.json
RUN cd /tmp && npm install
RUN mkdir -p /opt/app && cp -a /tmp/node_modules /opt/app/

WORKDIR /opt/app
ADD . /opt/app

CMD ["node", "index.js"]