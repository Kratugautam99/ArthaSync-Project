from app.models.schemas import BusinessProfile, AgentMode

# In a real app, this would be stored in the DB per user.
# Using a global dict for simplicity since we don't have user authentication.
_mock_profiles = {}

def get_profile(user_id: str = "default") -> BusinessProfile | None:
    return _mock_profiles.get(user_id)

def save_profile(profile_data: BusinessProfile | dict, user_id: str = "default") -> dict:
    if isinstance(profile_data, dict):
        # In a real app we'd convert dict to BusinessProfile, but for simplicity:
        _mock_profiles[user_id] = profile_data
    else:
        _mock_profiles[user_id] = profile_data.model_dump() if hasattr(profile_data, "model_dump") else profile_data
    return {"profile": _mock_profiles[user_id]}

def generate_default_profile() -> BusinessProfile:
    return BusinessProfile(
        business_type="Retail",
        size="Small",
        uses_tally=False,
        uses_zoho=False,
        enabled_modes=[AgentMode.INVOICE, AgentMode.DATABASE, AgentMode.GENERAL],
        completed_onboarding=False
    )

def get_enabled_modes(profile: BusinessProfile | dict) -> list[AgentMode]:
    modes = [AgentMode.INVOICE, AgentMode.DATABASE, AgentMode.OPERATIONS, AgentMode.MARKETING, AgentMode.CAMERA_TRACK, AgentMode.GENERAL, AgentMode.ONBOARDING]
    if isinstance(profile, dict):
        if profile.get("tally_integration"):
            modes.append(AgentMode.TALLY_SYNC)
        if profile.get("zoho_integration"):
            modes.append(AgentMode.ZOHO_SYNC)
    else:
        if profile.uses_tally:
            modes.append(AgentMode.TALLY_SYNC)
        if profile.uses_zoho:
            modes.append(AgentMode.ZOHO_SYNC)
    return modes
