#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="${SCRIPT_DIR}/k8s"
NAMESPACE="nodejs-tester"

echo "🚀 Installing NodeJS Tester to Kubernetes..."
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install it first."
    exit 1
fi

# Check if we're in a k8s context
if ! kubectl config current-context &> /dev/null; then
    echo "❌ No kubectl context configured. Please configure your cluster."
    exit 1
fi

echo "📋 Current kubectl context: $(kubectl config current-context)"
echo ""

# Step 1: Create namespace
echo "📦 Step 1: Creating namespace..."
kubectl apply -f "${K8S_DIR}/namespace.yaml"
echo "✅ Namespace created/updated: ${NAMESPACE}"
echo ""

# Step 2: Create secrets
echo "🔐 Step 2: Creating secrets..."
if [ -f "${K8S_DIR}/secret.yaml" ]; then
    kubectl apply -f "${K8S_DIR}/secret.yaml"
    echo "✅ Secrets created/updated"
else
    echo "⚠️  secret.yaml not found. Skipping secrets."
    echo "   Create it from secret.yaml.example:"
    echo "   cp ${K8S_DIR}/secret.yaml.example ${K8S_DIR}/secret.yaml"
fi
echo ""

# Step 3: Deploy application
echo "🚀 Step 3: Deploying application..."
kubectl apply -f "${K8S_DIR}/deployment.yaml"
kubectl rollout restart deployment/nodejs-tester -n "${NAMESPACE}"
echo "✅ Application deployed"
echo ""

# Step 4: Wait for pods to be ready
echo "⏳ Step 4: Waiting for application to be ready..."
echo "   This may take a minute as PostgreSQL starts..."

# Wait for the main pod
kubectl wait --for=condition=ready pod -l app=nodejs-tester -n "${NAMESPACE}" --timeout=300s || {
    echo "⚠️  Pods are not ready yet. You can check status with:"
    echo "   kubectl get pods -n ${NAMESPACE}"
}

echo ""
echo "✅ Installation complete!"
echo ""
echo "📊 Application Status:"
kubectl get pods -n "${NAMESPACE}"
echo ""
echo "📝 Services:"
kubectl get svc -n "${NAMESPACE}"
echo ""
echo "🌐 Ingress:"
kubectl get ingress -n "${NAMESPACE}"
echo ""
echo "🚀 To access the application:"
echo "   https://sentry-test.joshuascheel.com"
echo ""
echo "📝 To seed the database:"
echo "   kubectl exec -it -n ${NAMESPACE} deploy/nodejs-tester -c app -- npm run seed"
echo ""
echo "🔍 To view logs:"
echo "   kubectl logs -f -n ${NAMESPACE} deploy/nodejs-tester"
