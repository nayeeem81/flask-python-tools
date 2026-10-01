"""
The flask application package.
"""
from flask import Flask
from flask_socketio import SocketIO

app = Flask(__name__)
# Force Flask-SocketIO to use gevent instead of looking for eventlet
socketio = SocketIO(app,cors_allowed_origins="*", logger=False, engineio_logger=False, GEVENT_SUPPORT=True) 

# 3. ALWAYS import views last so they can safely see 'app' and 'socketio'
import FlaskPythonTools.views
