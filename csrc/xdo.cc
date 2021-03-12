#include <node.h>

extern "C" {
    #include <xdo.h>
}

using namespace v8;

class AddonData {
    public:
        explicit AddonData(Isolate *isolate): handle(0) {
            node::AddEnvironmentCleanupHook(isolate, DeleteInstance, this);

            this->handle = xdo_new(0);
        }

        xdo_t *handle;

        static void DeleteInstance(void *data) {
            AddonData *addon = static_cast<AddonData*>(data);
            xdo_free(addon->handle);
            delete addon;
        }
};

static void SendText(const v8::FunctionCallbackInfo<v8::Value> &info) {
    AddonData* data = reinterpret_cast<AddonData*>(info.Data().As<External>()->Value());
    Isolate *isolate = info.GetIsolate();

    if ( info.Length() < 1 ) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments", NewStringType::kNormal).ToLocalChecked()));
        return;
    }

    if ( !info[0]->IsString() ) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Argument is not a string", NewStringType::kNormal).ToLocalChecked()));
        return;
    }

    String::Utf8Value param(isolate, info[0]);

    xdo_enter_text_window(data->handle, 0, *param, 20000);

    info.GetReturnValue().Set(0);
}

static void SendKey(const v8::FunctionCallbackInfo<v8::Value> &info) {
    AddonData* data = reinterpret_cast<AddonData*>(info.Data().As<External>()->Value());
    Isolate *isolate = info.GetIsolate();

    if ( info.Length() < 1 ) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Wrong number of arguments", NewStringType::kNormal).ToLocalChecked()));
        return;
    }

    if ( !info[0]->IsString() ) {
        isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Argument is not a string", NewStringType::kNormal).ToLocalChecked()));
        return;
    }

    String::Utf8Value param(isolate, info[0]);

    xdo_send_keysequence_window(data->handle, 0, *param, 20000);

    info.GetReturnValue().Set(0);
}

NODE_MODULE_INIT(/* exports, module, context */){
    Isolate* isolate = context->GetIsolate();
    AddonData* data = new AddonData(isolate);
    Local<External> external = External::New(isolate, data);

    exports->Set(context,
        String::NewFromUtf8(isolate, "sendtext", NewStringType::kNormal).ToLocalChecked(),
        FunctionTemplate::New(isolate, SendText, external)->GetFunction(context).ToLocalChecked()
    ).FromJust();

    exports->Set(context,
        String::NewFromUtf8(isolate, "sendkey", NewStringType::kNormal).ToLocalChecked(),
        FunctionTemplate::New(isolate, SendKey, external)->GetFunction(context).ToLocalChecked()
    ).FromJust();
}