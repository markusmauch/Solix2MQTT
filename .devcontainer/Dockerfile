FROM node:21-alpine3.17
RUN apk add --no-cache git curl age python3
RUN npm i -g typescript

# SOPS
ENV SOPS_VERSION 3.7.1
ENV SOPS_AGE_KEY_FILE=/sops/keys.txt
ENV EDITOR=code
RUN curl -L https://github.com/mozilla/sops/releases/download/v${SOPS_VERSION}/sops-v${SOPS_VERSION}.linux -o /usr/local/bin/sops
RUN chmod +x /usr/local/bin/sops

# JINA
RUN wget https://bootstrap.pypa.io/get-pip.py
RUN python3 get-pip.py
RUN pip install jinja2-cli pyyaml
