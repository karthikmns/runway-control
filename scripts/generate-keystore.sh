#!/usr/bin/env bash
set -euo pipefail

KEYSTORE_PATH="${1:-android/runway-control-upload.jks}"
KEY_ALIAS="${2:-runway-upload}"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "Keystore already exists at $KEYSTORE_PATH — refusing to overwrite."
  exit 1
fi

echo "Generating Google Play Upload Keystore at: $KEYSTORE_PATH"
echo "IMPORTANT: Store this .jks file and passwords in a safe password manager / backup."
echo "NEVER commit this file or android/keystore.properties to git."
echo ""

read -r -s -p "Enter new Keystore Password (min 6 chars): " STORE_PASS
echo ""
read -r -s -p "Confirm Keystore Password: " STORE_PASS_CONFIRM
echo ""

if [ "$STORE_PASS" != "$STORE_PASS_CONFIRM" ]; then
  echo "Passwords do not match."
  exit 1
fi

keytool -genkeypair -v \
  -keystore "$KEYSTORE_PATH" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias "$KEY_ALIAS" \
  -storepass "$STORE_PASS" \
  -keypass "$STORE_PASS" \
  -dname "CN=Karthik Mungamuru, OU=Games, O=Runway Control, L=City, ST=State, C=US"

cat > android/keystore.properties <<EOF
storeFile=$(realpath "$KEYSTORE_PATH")
storePassword=$STORE_PASS
keyAlias=$KEY_ALIAS
keyPassword=$STORE_PASS
EOF

echo ""
echo "Done! Created:"
echo "  - $KEYSTORE_PATH (gitignored — BACK THIS UP!)"
echo "  - android/keystore.properties (gitignored)"
echo ""
echo "Now run: npm run android:bundle"
echo "Signed AAB will be at: android/app/build/outputs/bundle/release/app-release.aab"
