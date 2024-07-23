const { Stack, Duration } = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const { RemovalPolicy } = require("aws-cdk-lib");
const ecs = require("aws-cdk-lib/aws-ecs");
const ecs_patterns = require("aws-cdk-lib/aws-ecs-patterns");
const ec2 = require("aws-cdk-lib/aws-ec2");
const ecr = require("aws-cdk-lib/aws-ecr");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");

class CdkStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: "graphdatabasefrontend",
      websiteIndexDocument: "index.html",
      publicReadAccess: true, //use cloudfront instead blahblahblahblah
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
    });

    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 2,
    });

    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc,
      clusterName: "graphdatabasecluster",
    });

    const ecrRepository = ecr.Repository.fromRepositoryName(
      this,
      "Repo",
      "graphdatabaserp"
    );

    const neo4jSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      "Neo4jSecret",
      "neo4j/credentials"
    );

    new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      "MyFargateService",
      {
        cluster: cluster,
        cpu: 1024,
        desiredCount: 1,
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),
          containerPort: 5000,
          environment: {
            FLASK_APP: "./main.py",
          },
          secrets: {
            NEO4J_URI: ecs.Secret.fromSecretsManager(neo4jSecret, "NEO4J_URI"),
            NEO4J_USERNAME: ecs.Secret.fromSecretsManager(
              neo4jSecret,
              "NEO4J_USERNAME"
            ),
            NEO4J_PASSWORD: ecs.Secret.fromSecretsManager(
              neo4jSecret,
              "NEO4J_PASSWORD"
            ),
          },
        },
        memoryLimitMiB: 2048,
        publicLoadBalancer: true,

        serviceName: "graphdatabaseservice",
        loadBalancerName: "graphdatabaselb",
      }
    );
  }
}

module.exports = { CdkStack };
