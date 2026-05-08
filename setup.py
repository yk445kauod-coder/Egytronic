from setuptools import setup, find_packages

setup(
    name="egytronic",
    version="1.0.0",
    description="Universal Agent Development Platform",
    author="Egytronic",
    author_email="dev@egytronic.com",
    packages=find_packages(),
    install_requires=[
        "aiohttp>=3.8.0",
        "click>=8.0",
        "fastapi>=0.100.0",
        "uvicorn>=0.20.0",
        "pydantic>=2.0",
        "aiofiles>=23.0",
        "pyyaml>=6.0",
    ],
    extras_require={
        "dev": ["pytest>=7.0", "pytest-asyncio>=0.21"],
        "all": ["playwright>=1.40"],
    },
    entry_points={
        "console_scripts": [
            "egy=egytronic.cli.main:main",
        ],
    },
    python_requires=">=3.10",
)