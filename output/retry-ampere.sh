#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Auto-retry Ampere A1.Flex creation (Always Free eligible)
# Usage: nohup bash ~/retry-ampere.sh &
# Check log: cat ~/retry-ampere.log
#
# Always Free ARM limits: max 4 OCPUs + 24 GB RAM total
# NOTE: "Always Free" label only appears after Free Trial → PAYG
#       conversion. During trial, ARM uses trial credits but will
#       transition to Always Free automatically if within limits.
# ─────────────────────────────────────────────────────────────────

LOG="$HOME/retry-ampere.log"

TENANCY_ID=$(oci iam availability-domain list --query "data[0].\"compartment-id\"" --raw-output)
AD=$(oci iam availability-domain list --query "data[0].name" --raw-output)
SUBNET_ID=$(oci network subnet list --compartment-id "$TENANCY_ID" --query "data[0].id" --raw-output)
IMAGE_ID=$(oci compute image list --compartment-id "$TENANCY_ID" --operating-system "Oracle Linux" --operating-system-version "9" --shape "VM.Standard.A1.Flex" --sort-by TIMECREATED --sort-order DESC --query "data[0].id" --raw-output)

if [ -f ~/.ssh/id_rsa.pub ]; then
  SSH_KEY=$(cat ~/.ssh/id_rsa.pub)
else
  ssh-keygen -t rsa -b 2048 -f ~/.ssh/id_rsa -N "" -q
  SSH_KEY=$(cat ~/.ssh/id_rsa.pub)
fi

echo "============================================" >> "$LOG"
echo "  Script started at $(date)" >> "$LOG"
echo "  Compartment: $TENANCY_ID" >> "$LOG"
echo "  AD: $AD" >> "$LOG"
echo "============================================" >> "$LOG"

ATTEMPT=0
while true; do
  ATTEMPT=$((ATTEMPT + 1))

  # ── Duplicate check: exit if instance already exists ──
  EXISTING=$(oci compute instance list \
    --compartment-id "$TENANCY_ID" \
    --display-name "DailyFinance-ARM" \
    --lifecycle-state RUNNING \
    --query "data[0].id" --raw-output 2>/dev/null)

  if [ "$EXISTING" != "None" ] && [ "$EXISTING" != "null" ] && [ -n "$EXISTING" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Instance already exists ($EXISTING). Exiting." >> "$LOG"
    exit 0
  fi

  echo "[Attempt $ATTEMPT] $(date '+%Y-%m-%d %H:%M:%S') — Creating instance..." >> "$LOG"

  RESULT=$(oci compute instance launch \
    --compartment-id "$TENANCY_ID" \
    --availability-domain "$AD" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config '{"ocpus":1,"memoryInGBs":6}' \
    --subnet-id "$SUBNET_ID" \
    --image-id "$IMAGE_ID" \
    --display-name "DailyFinance-ARM" \
    --assign-public-ip true \
    --boot-volume-size-in-gbs 50 \
    --metadata "{\"ssh_authorized_keys\": \"$SSH_KEY\"}" \
    2>&1)

  if echo "$RESULT" | grep -q '"lifecycle-state"'; then
    echo "" >> "$LOG"
    echo "============================================" >> "$LOG"
    echo "  SUCCESS! Instance created at $(date)" >> "$LOG"
    echo "============================================" >> "$LOG"
    echo "$RESULT" | grep -E '"display-name"|"lifecycle-state"|"public-ip"|"id"' >> "$LOG"
    exit 0
  else
    ERROR=$(echo "$RESULT" | grep -o '"message".*' | head -1)
    echo "  Failed: $ERROR" >> "$LOG"
    echo "  Retrying in 5 minutes..." >> "$LOG"
    sleep 300
  fi
done
