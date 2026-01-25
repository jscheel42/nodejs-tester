#!/bin/bash

set -e

IMAGE_NAME="jscheel42/nodejs-tester"
TAG="${1:-latest}"

echo "Building Docker image: ${IMAGE_NAME}:${TAG}"
docker build -t "${IMAGE_NAME}:${TAG}" .

echo "Tagging image: ${IMAGE_NAME}:${TAG}"
docker tag "${IMAGE_NAME}:${TAG}" "${IMAGE_NAME}:latest"

echo "Pushing image: ${IMAGE_NAME}:${TAG}"
docker push "${IMAGE_NAME}:${TAG}"

if [ "${TAG}" != "latest" ]; then
  echo "Pushing image: ${IMAGE_NAME}:latest"
  docker push "${IMAGE_NAME}:latest"
fi

echo "Done! Image ${IMAGE_NAME}:${TAG} has been pushed."
