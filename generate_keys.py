from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

private_key = ec.generate_private_key(ec.SECP256R1())
private_numbers = private_key.private_numbers()

public_key = private_key.public_key()
public_bytes = public_key.public_bytes(
    encoding=serialization.Encoding.X962,
    format=serialization.PublicFormat.UncompressedPoint
)

import base64

def to_base64(b):
    return base64.urlsafe_b64encode(b).decode('utf-8').strip('=')

# Clean VAPID keys (raw bytes -> base64url)
priv = to_base64(private_numbers.private_value.to_bytes(32, 'big'))
pub = to_base64(public_bytes)

print(f"VAPID_PRIVATE_KEY={priv}")
print(f"VAPID_PUBLIC_KEY={pub}")
