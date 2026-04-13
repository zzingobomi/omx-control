import zenoh
import logging

logger = logging.getLogger(__name__)


class ZenohSession:
    _session: zenoh.Session | None = None

    @classmethod
    def get(cls) -> zenoh.Session:
        if cls._session is None:
            raise RuntimeError(
                "ZenohSession이 초기화되지 않았습니다. "
                "먼저 ZenohSession.init()을 호출하세요."
            )
        return cls._session

    @classmethod
    def init(cls, config: zenoh.Config | None = None) -> zenoh.Session:
        if cls._session is not None:
            logger.warning("ZenohSession이 이미 초기화되어 있습니다.")
            return cls._session

        cfg = config or zenoh.Config()
        cls._session = zenoh.open(cfg)
        logger.info("Zenoh 세션 시작됨")
        return cls._session

    @classmethod
    def close(cls) -> None:
        if cls._session is not None:
            cls._session.close()
            cls._session = None
            logger.info("Zenoh 세션 종료됨")
