#!/bin/bash

# Install deps, build cli and link it so it is usable
npm i
npm run build
npm link

# Get nodecg so you can test the cli using this installation
[ ! -d "nodecg" ] && git clone https://github.com/nodecg/nodecg.git 

cd nodecg && npm i --prod