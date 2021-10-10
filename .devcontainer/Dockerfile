# See here for image contents: https://github.com/microsoft/vscode-dev-containers/tree/v0.162.0/containers/typescript-node/.devcontainer/base.Dockerfile

FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-16

# Get dependencies that are used by nodecg-io if you do a development build
RUN apt update && apt install libusb-1.0-0-dev libasound2-dev libudev-dev -y
