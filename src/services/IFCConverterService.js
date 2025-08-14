/**
 * Server-side IFC to glTF converter service
 * Uses Python + IfcOpenShell for reliable conversion
 */

class IFCConverterService {
  constructor() {
    this.conversionEndpoint = '/api/convert-ifc';
  }

  /**
   * Convert IFC file to glTF using server-side Python script
   */
  async convertIFCToGLTF(ifcFile, fileName) {
    console.log(`🔄 Converting IFC file ${fileName} to glTF via server...`);
    
    const formData = new FormData();
    formData.append('ifc_file', ifcFile);
    formData.append('filename', fileName);

    try {
      const response = await fetch(this.conversionEndpoint, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server conversion failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ IFC converted successfully:`, result);
      
      return {
        success: true,
        gltfUrl: result.gltf_url,
        metadata: result.metadata,
        fileName: fileName
      };
      
    } catch (error) {
      console.error(`❌ IFC conversion failed:`, error);
      return {
        success: false,
        error: error.message,
        fileName: fileName
      };
    }
  }

  /**
   * Load converted glTF into xeokit viewer
   */
  async loadGLTFIntoXeokit(xeokitViewer, gltfUrl, modelId) {
    console.log(`🎬 Loading glTF into xeokit: ${gltfUrl}`);
    
    const model = xeokitViewer.viewer.scene.createModel({
      id: modelId,
      isObject: true
    });

    const gltfLoader = new xeokitViewer.GLTFLoaderPlugin(xeokitViewer.viewer);
    
    try {
      await gltfLoader.load({
        id: modelId,
        src: gltfUrl,
        edges: true
      });
      
      console.log(`✅ glTF model loaded successfully: ${modelId}`);
      return { success: true, model, modelId };
      
    } catch (error) {
      console.error(`❌ Failed to load glTF:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default IFCConverterService; 