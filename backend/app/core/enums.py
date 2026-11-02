from enum import StrEnum


class UserRole(StrEnum):
    USER = "USER"
    TEACHER = "TEACHER"


class SessionStatus(StrEnum):
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
