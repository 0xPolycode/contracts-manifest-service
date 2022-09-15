#!/bin/bash

if [[ -z "$DOCKER_USERNAME" ]]; then
    echo "DOCKER_USERNAME is missing"
    exit 1
fi

if [[ -z "$DOCKER_PASSWORD" ]]; then
    echo "DOCKER_PASSWORD is missing"
    exit 1
fi

echo "$DOCKER_USERNAME"
echo "$DOCKER_PASSWORD"

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
