"""
This script runs the FlaskPythonTools application using a development server.
"""

import warnings
from os import environ
from FlaskPythonTools import app, socketio

# Suppress Eventlet deprecation warning from python-engineio
# Eventlet is maintained in bugfix mode but works fine for development
warnings.filterwarnings('ignore', category=DeprecationWarning, module='.*eventlet.*')

if __name__ == '__main__':
    # Using '127.0.0.1' ensures Windows resolves the address correctly without errors
    socketio.run(app, host='127.0.0.1', port=5000, debug=True)


