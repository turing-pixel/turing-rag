"""JWT subject uses user uuid."""

from datetime import timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core import security
from app.models.base import Base
from app.models.user import User


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    user = User(
        email="jwt@example.com",
        username="jwt_user",
        hashed_password="hash",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    yield session, user
    session.close()


class TestJwtAuth:
    def test_token_sub_is_uuid(self, db_session):
        session, user = db_session
        token = security.create_access_token(
            data={"sub": user.uuid},
            expires_delta=timedelta(minutes=5),
        )
        resolved = security.get_current_user(db=session, token=token)
        assert resolved.id == user.id
        assert resolved.uuid == user.uuid
