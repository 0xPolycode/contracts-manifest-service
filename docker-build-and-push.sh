#!/bin/bash

version=$(cat package.json \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g')

version="$(echo -e "${version}" | sed -e 's/^[[:space:]]*//')"
echo "Docker image: ampnet/contracts-manifest-service:$version"
docker build -t ampnet/contracts-manifest-service:$version -t ampnet/contracts-manifest-service:latest .
docker push ampnet/contracts-manifest-service:$version
docker push ampnet/contracts-manifest-service:latest
