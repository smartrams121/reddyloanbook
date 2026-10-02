#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Daily Finance — OCI Always Free ARM Instance Provisioner
# Run from OCI Cloud Shell or any machine with OCI CLI configured
#
# Creates a VM.Standard.A1.Flex (ARM) instance within Always Free limits:
#   - 1 OCPU, 6 GB RAM (max free: 4 OCPUs + 24 GB across all A1 instances)
#   - Oracle Linux 9 (aarch64)
#   - Home region only (required for Always Free)
#
# NOTE: "Always Free" label only appears after Free Trial → Pay As You Go
#       conversion. During trial, ARM instances use trial credits but will
#       transition to Always Free automatically if within limits.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
INSTANCE_NAME="DailyFinance-ARM"
SHAPE="VM.Standard.A1.Flex"
OCPUS=1
MEMORY_GB=6
OS_IMAGE="Oracle Linux"
OS_VERSION="9"
BOOT_VOLUME_GB=50

# ── Auto-detect from tenancy ────────────────────────────────────────────────
echo "══════════════════════════════════════════════"
echo "  Daily Finance — OCI Instance Provisioner"
echo "══════════════════════════════════════════════"
echo ""

COMPARTMENT_ID=$(oci iam compartment list \
  --compartment-id-in-subtree true \
  --query 'data[0].id' --raw-output 2>/dev/null) || \
COMPARTMENT_ID=$(oci iam tenancy get --query 'data.id' --raw-output)

echo "▸ Compartment: ${COMPARTMENT_ID}"

# Get home region (Always Free resources must be in home region)
HOME_REGION=$(oci iam region-subscription list \
  --query 'data[?"is-home-region"]|[0]."region-name"' --raw-output)
echo "▸ Home region: ${HOME_REGION}"

# Get availability domain
AD=$(oci iam availability-domain list \
  --compartment-id "${COMPARTMENT_ID}" \
  --query 'data[0].name' --raw-output)
echo "▸ Availability domain: ${AD}"

# ── Find existing VCN or create one ─────────────────────────────────────────
echo ""
echo "▸ Looking for existing VCN..."
VCN_ID=$(oci network vcn list \
  --compartment-id "${COMPARTMENT_ID}" \
  --query 'data[0].id' --raw-output 2>/dev/null || echo "")

if [ -z "${VCN_ID}" ] || [ "${VCN_ID}" = "null" ]; then
  echo "  Creating VCN..."
  VCN_ID=$(oci network vcn create \
    --compartment-id "${COMPARTMENT_ID}" \
    --display-name "dailyfinance-vcn" \
    --cidr-blocks '["10.0.0.0/16"]' \
    --query 'data.id' --raw-output)
fi
echo "  VCN: ${VCN_ID}"

# ── Find existing subnet or create one ──────────────────────────────────────
SUBNET_ID=$(oci network subnet list \
  --compartment-id "${COMPARTMENT_ID}" \
  --vcn-id "${VCN_ID}" \
  --query 'data[0].id' --raw-output 2>/dev/null || echo "")

if [ -z "${SUBNET_ID}" ] || [ "${SUBNET_ID}" = "null" ]; then
  echo "  Creating subnet..."
  # Create internet gateway
  IG_ID=$(oci network internet-gateway create \
    --compartment-id "${COMPARTMENT_ID}" \
    --vcn-id "${VCN_ID}" \
    --display-name "dailyfinance-igw" \
    --is-enabled true \
    --query 'data.id' --raw-output)

  # Get default route table
  RT_ID=$(oci network route-table list \
    --compartment-id "${COMPARTMENT_ID}" \
    --vcn-id "${VCN_ID}" \
    --query 'data[0].id' --raw-output)

  # Add internet route
  oci network route-table update \
    --rt-id "${RT_ID}" \
    --route-rules "[{\"destination\":\"0.0.0.0/0\",\"networkEntityId\":\"${IG_ID}\"}]" \
    --force

  SUBNET_ID=$(oci network subnet create \
    --compartment-id "${COMPARTMENT_ID}" \
    --vcn-id "${VCN_ID}" \
    --display-name "dailyfinance-subnet" \
    --cidr-block "10.0.0.0/24" \
    --route-table-id "${RT_ID}" \
    --query 'data.id' --raw-output)
fi
echo "  Subnet: ${SUBNET_ID}"

# ── Find Oracle Linux 9 ARM image ──────────────────────────────────────────
echo ""
echo "▸ Finding latest Oracle Linux 9 ARM image..."
IMAGE_ID=$(oci compute image list \
  --compartment-id "${COMPARTMENT_ID}" \
  --operating-system "${OS_IMAGE}" \
  --operating-system-version "${OS_VERSION}" \
  --shape "${SHAPE}" \
  --sort-by TIMECREATED \
  --sort-order DESC \
  --query 'data[0].id' --raw-output)
echo "  Image: ${IMAGE_ID}"

# ── SSH key ─────────────────────────────────────────────────────────────────
SSH_KEY_FILE="${HOME}/.ssh/id_rsa.pub"
if [ ! -f "${SSH_KEY_FILE}" ]; then
  echo ""
  echo "▸ No SSH key found. Generating one..."
  ssh-keygen -t rsa -b 4096 -f "${HOME}/.ssh/id_rsa" -N "" -q
  echo "  Key generated: ${HOME}/.ssh/id_rsa"
fi
SSH_KEY=$(cat "${SSH_KEY_FILE}")
echo "▸ SSH public key loaded"

# ── Check for existing instance with same name ─────────────────────────────
EXISTING=$(oci compute instance list \
  --compartment-id "${COMPARTMENT_ID}" \
  --display-name "${INSTANCE_NAME}" \
  --lifecycle-state RUNNING \
  --query 'data[0].id' --raw-output 2>/dev/null || echo "")

if [ -n "${EXISTING}" ] && [ "${EXISTING}" != "null" ]; then
  echo ""
  echo "⚠ Instance '${INSTANCE_NAME}' already exists and is RUNNING."
  echo "  OCID: ${EXISTING}"
  echo "  Terminate it first if you want to recreate."
  exit 1
fi

# ── Launch instance ─────────────────────────────────────────────────────────
echo ""
echo "▸ Launching ${INSTANCE_NAME}..."
echo "  Shape: ${SHAPE} (${OCPUS} OCPU, ${MEMORY_GB} GB RAM)"
echo "  Image: Oracle Linux ${OS_VERSION} (aarch64)"
echo ""

INSTANCE_ID=$(oci compute instance launch \
  --compartment-id "${COMPARTMENT_ID}" \
  --availability-domain "${AD}" \
  --display-name "${INSTANCE_NAME}" \
  --shape "${SHAPE}" \
  --shape-config "{\"ocpus\": ${OCPUS}, \"memoryInGBs\": ${MEMORY_GB}}" \
  --image-id "${IMAGE_ID}" \
  --subnet-id "${SUBNET_ID}" \
  --assign-public-ip true \
  --boot-volume-size-in-gbs "${BOOT_VOLUME_GB}" \
  --metadata "{\"ssh_authorized_keys\": \"${SSH_KEY}\"}" \
  --query 'data.id' --raw-output)

echo "  Instance OCID: ${INSTANCE_ID}"

# ── Wait for RUNNING state ──────────────────────────────────────────────────
echo ""
echo "▸ Waiting for instance to reach RUNNING state..."
oci compute instance get \
  --instance-id "${INSTANCE_ID}" \
  --wait-for-state RUNNING \
  --max-wait-seconds 300 > /dev/null 2>&1

# ── Get public IP ───────────────────────────────────────────────────────────
sleep 10
PUBLIC_IP=$(oci compute instance list-vnics \
  --instance-id "${INSTANCE_ID}" \
  --query 'data[0]."public-ip"' --raw-output)

echo ""
echo "══════════════════════════════════════════════"
echo "  Instance created successfully!"
echo "══════════════════════════════════════════════"
echo ""
echo "  Name:      ${INSTANCE_NAME}"
echo "  Public IP: ${PUBLIC_IP}"
echo "  Shape:     ${SHAPE} (${OCPUS} OCPU, ${MEMORY_GB} GB RAM)"
echo "  SSH:       ssh opc@${PUBLIC_IP}"
echo ""
echo "  Always Free limits (ARM A1.Flex):"
echo "    Max 4 OCPUs + 24 GB RAM total across all A1 instances"
echo "    This instance uses: ${OCPUS} OCPU + ${MEMORY_GB} GB RAM"
echo ""
echo "  ⚠ 'Always Free' label appears only after Free Trial → PAYG conversion"
echo ""
echo "Next steps:"
echo "  1. Open firewall ports (SSH 22, HTTP 80, HTTPS 443):"
echo "     - OCI Console → Networking → VCN → Security Lists → Add Ingress Rules"
echo "  2. SSH in and run the server setup script:"
echo "     ssh opc@${PUBLIC_IP}"
echo "     sudo bash /dev/stdin < deploy/scripts/setup-oci.sh"
echo ""
