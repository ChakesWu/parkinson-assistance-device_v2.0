"""
帕金森輔助裝置系統安裝腳本
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="parkinson-assistance-device",
    version="1.0.0",
    author="帕金森輔助裝置開發團隊",
    author_email="contact@parkinson-device.com",
    description="基於Arduino和AI的帕金森患者輔助裝置系統",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/parkinson-assistance-device",
    packages=find_packages(where="python"),
    package_dir={"": "python"},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Healthcare Industry",
        "Topic :: Scientific/Engineering :: Medical Science Apps.",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=6.0.0",
            "flake8>=4.0.0", 
            "black>=22.0.0",
            "jupyter>=1.0.0",
        ],
        "viz": [
            "plotly>=5.0.0",
            "shap>=0.40.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "parkinson-system=deployment.system_integration:main",
            "collect-data=data_collection.arduino_collector:main",
            "train-model=machine_learning.cnn_lstm_model:main",
            "analyze-parkinson=analysis.parkinson_analyzer:main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.md", "*.txt", "*.yml", "*.yaml"],
    },
)