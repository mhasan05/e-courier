import secrets


def generate_otp() -> str:
    """Random 4-digit delivery OTP, stored on the parcel at booking.

    In production a background task 'sends' this to the recipient via SMS; for now
    it's exposed to admin/branch for testing (as in the frontend mock).
    """
    return f"{secrets.randbelow(10000):04d}"


def verify_otp(expected: str, provided: str) -> bool:
    return bool(expected) and str(provided).strip() == str(expected).strip()
